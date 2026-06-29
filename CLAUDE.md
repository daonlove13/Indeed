@AGENTS.md
@SPEC.md

---

# indeed — 프로젝트 컨텍스트

한국 대학생 과팅(미팅) 매칭 앱. 학생증 인증 → 팀 생성 → 매칭 → 채팅 플로우.

---

## 기술 스택

| 항목 | 값 |
|------|-----|
| 프레임워크 | Expo SDK 54, React Native 0.81.5 |
| JS 엔진 | Hermes (crypto 전역 없음 — Math.random 사용) |
| 라우팅 | Expo Router v6 (파일 기반) |
| 백엔드 | Supabase (DB, Auth, Storage, Realtime, Edge Functions) |
| 빌드/OTA | EAS (Expo Application Services) |
| 알림 | Expo Notifications (Firebase SDK 없음) |

---

## 주요 계정 및 식별자 (비민감)

| 항목 | 값 |
|------|-----|
| GitHub | https://github.com/daonlove13/Indeed.git |
| EAS 계정 | judason |
| EAS 프로젝트 ID | `4ca294a5-b95c-4c89-86de-5473ea252567` |
| Supabase 프로젝트 URL | `https://pmompybsbnkrjhdhikcr.supabase.co` |
| Supabase 프로젝트 ID | `pmompybsbnkrjhdhikcr` |
| 앱 패키지명 | `com.indeed.app` |
| 딥링크 scheme | `indeed://` |
| OTA 채널 | `preview` (설치된 APK 채널) |
| OTA 브랜치 | `preview` ← **항상 `--branch preview`로 배포해야 함** |

---

## OTA 업데이트 명령어

```bash
# Android OTA (항상 preview 브랜치)
npx eas update --platform android --branch preview --message "변경 내용"

# main 브랜치로 배포하면 앱이 업데이트를 못 받음 (채널 불일치)
```

---

## Supabase 주요 테이블

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 정보. `verified_status` (pending/approved/rejected), `student_card_url`, `card_submitted_at`, `rejection_reason`, `expo_push_token` |
| `teams` | 팀. `leader_id`, `invite_code`, `gender`, `size` (2v2/3v3), `is_matched` |
| `team_members` | 팀원 연결 |
| `matches` | 매칭된 팀 쌍. `team_a`, `team_b`, `muted_by` |
| `messages` | 채팅 메시지. `match_id`, `sender_id`, `content` |
| `notifications` | 인앱 알림. `user_id`, `type`, `title`, `content`, `is_read` |
| `push_subscriptions` | Expo 푸시 토큰. `user_id`, `expo_push_token` |
| `reports` | 신고. `reporter_id`, `target_id`, `content`, `status`, `admin_note` |

---

## Supabase Edge Function

- 함수명: `notify`
- 위치: `supabase/functions/notify/index.ts`
- 트리거: DB 웹훅 (users UPDATE, matches INSERT, messages INSERT)
- 기능: Expo 푸시 발송 + `notifications` 테이블에 인앱 알림 저장
- 배포: `npx supabase functions deploy notify`

---

## 파일 구조 (주요)

```
src/
  app/
    _layout.tsx          # 루트 레이아웃, 푸시 토큰 등록
    (tabs)/
      index.tsx          # 홈 (팀 현황)
      matching.tsx       # 매칭
      chat.tsx           # 채팅 목록
      my.tsx             # 마이페이지
    admin/
      index.tsx          # 관리자 (학생증 심사 3섹션 + 신고)
      verify-detail.tsx  # 학생증 상세 심사
    login.tsx
    student-id.tsx       # 학생증 업로드 → /pending 으로 navigate
    pending.tsx          # 심사 대기 (Realtime 구독으로 승인 시 자동 이동)
    invite-link.tsx      # 초대 코드 공유
    join-team.tsx        # 초대 코드 입력
    create-team.tsx
    chat-room.tsx
    notifications.tsx
  services/api.ts        # 모든 Supabase 호출
  lib/
    supabase.ts          # Supabase 클라이언트 (anon key 포함)
    notifications.ts     # Expo 푸시 토큰 등록
  hooks/useData.ts       # 공통 데이터 훅
supabase/
  functions/notify/      # Edge Function
```

---

## 주요 해결된 이슈 (히스토리)

- **Hermes crypto 오류**: `crypto.getRandomValues` 없음 → `Math.random()` 루프로 교체 (`api.ts` createTeam)
- **OTA 채널 불일치**: 빌드 채널 `preview` ↔ 배포 브랜치 반드시 `preview` 일치
- **Realtime 승인 알림**: 학생증 업로드 후 `student-id.tsx`에서 `/pending`으로 navigate해야 Realtime 구독 활성화
- **인앱 알림 비어있음**: Edge Function이 push만 보내고 DB 저장 안 함 → `saveNotification()` 추가
- **OTA web 에러**: `--platform android`만 사용 (web SSR에서 AsyncStorage 크래시)

---

## 새 PC 세팅 시 필요한 시크릿

아래 값들은 git에 없으므로 직접 복사해야 함.

### 1. Supabase anon key
- **위치**: `src/lib/supabase.ts`에 하드코딩되어 있음 (git에 있음, 별도 작업 불필요)

### 2. Supabase service role key
- **용도**: Edge Function 환경변수, Supabase CLI 연동
- **가져오는 곳**: https://supabase.com/dashboard/project/pmompybsbnkrjhdhikcr/settings/api → "service_role" 키
- **설정 방법**: `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<값>`

### 3. Supabase Management API 토큰 (Access Token)
- **용도**: `supabase` CLI 로그인, DB 마이그레이션, 함수 배포
- **가져오는 곳**: https://supabase.com/dashboard/account/tokens → 토큰 생성
- **설정 방법**: `$env:SUPABASE_ACCESS_TOKEN="sbp_..."` (터미널 세션 내 임시) 또는 `npx supabase login`

### 4. EAS / Expo 계정
- **로그인**: `npx eas login` → judason 계정으로 로그인
- **확인**: `npx eas whoami`

### 5. Supabase CLI 프로젝트 연결
```bash
npx supabase link --project-ref pmompybsbnkrjhdhikcr
```

---

## 관리자 계정

- Supabase `users` 테이블에서 `is_admin = true` 컬럼으로 구분
- 관리자 페이지: `src/app/admin/index.tsx`
