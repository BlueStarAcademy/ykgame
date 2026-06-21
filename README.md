# YK건기 브랜드 캐주얼 게임

YK건기 장비 브랜드(얀마, 존디어, 마니또 등) 8종 미니게임을 즐길 수 있는 모바일 웹 플랫폼입니다.

## 기능

- **로그인/회원가입**: 아이디·비밀번호, 아이디 저장, 자동 로그인
- **소셜 로그인**: 카카오/구글 버튼 UI (API 키 설정 후 연동 가능)
- **닉네임 설정**: 최초 로그인 시 1회
- **홈 화면**: 프로필 박스 + 8개 게임 카드
- **8개 미니게임**: Phaser 3 기반 터치 조작
- **랭킹/재화**: 월간 Top 10, 별(재화) 획득
- **관리자**: 회원 관리, 재화 지급/차감

## 관리자 계정

- **아이디**: `ykgameadmin`
- **비밀번호**: `123456`

## 로컬 실행

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 환경 변수

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | SQLite: `file:./dev.db` / PostgreSQL: 연결 문자열 |
| `AUTH_SECRET` | NextAuth JWT 시크릿 |
| `AUTH_URL` | 앱 URL (예: `http://localhost:3000`) |
| `KAKAO_CLIENT_ID` | 카카오 OAuth (선택) |
| `GOOGLE_CLIENT_ID` | Google OAuth (선택) |

## 배포 (Vercel + PostgreSQL)

1. Neon/Supabase 등에서 PostgreSQL 생성
2. `DATABASE_URL`을 PostgreSQL 연결 문자열로 설정
3. `prisma/schema.prisma`의 `provider`를 `postgresql`로 변경
4. Vercel에 배포 후 `AUTH_SECRET`, `AUTH_URL` 설정
5. `npx prisma migrate deploy` 실행

## 프로젝트 구조

```
src/
├── app/           # 페이지 및 API 라우트
├── components/    # UI 컴포넌트
├── games/         # Phaser 미니게임
└── lib/           # auth, prisma, games 설정
```

## 게임 목록

| # | 브랜드 | 미션 |
|---|--------|------|
| 1 | YANMAR | 굴삭기로 흙 옮기기 |
| 2 | JOHN DEERE | 트랙터로 밭 갈기 |
| 3 | MANITOU | 톤백 옮기기 |
| 4 | WIRTGEN | 도로 작업하기 |
| 5 | VÖGELE | 아스팔트 포장하기 |
| 6 | GEHL | 축사 퇴비 옮기기 |
| 7 | HAMM | 도로 다지기 |
| 8 | KLEEMANN | 암석 분쇄·선별 |
