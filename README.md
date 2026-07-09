# YK건기 브랜드 캐주얼 게임

YK건기 장비 브랜드 8종 미니게임을 즐길 수 있는 모바일 웹 플랫폼입니다.

## 랜딩 페이지

- `/` — 비로그인 방문자용 공개 페이지 (장비 소개, QR, PWA 체험 CTA)
- **체험하기** / **QR 스캔** → PWA 전체화면 로그인 → 홈 → 얀마 굴착기 게임
- 모바일: Chrome **홈 화면에 추가** 또는 Safari **공유 → 홈 화면에 추가**

## 관리자 계정

- **아이디**: `ykgameadmin` / **비밀번호**: `123456`

---

## Railway 자동 배포 (GitHub 연동)

GitHub에 push하면 Railway가 자동으로 빌드·배포합니다.

### 최초 1회 — Railway 대시보드 설정

1. **Postgres** 서비스가 같은 프로젝트에 있는지 확인
2. **ykgame-web** 서비스 → **Variables** 탭:

| 변수 | 값 |
|------|-----|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Reference 추가) |
| `AUTH_SECRET` | `openssl rand -base64 32` 결과값 (미설정 시 Railway에서 자동 생성) |

3. **Settings → Networking → Generate Domain**
4. GitHub에 push → 자동 배포 시작

> `AUTH_URL`은 Railway 도메인(`RAILWAY_PUBLIC_DOMAIN`)으로 **자동 설정**됩니다.  
> 배포 시 **migrate + admin seed**도 자동 실행됩니다 (`scripts/railway-predeploy.sh`).

### 자동 적용되는 항목

- `railway.toml` / `nixpacks.toml` — 빌드·배포 설정
- Pre-deploy: `prisma migrate deploy` + admin seed
- PostgreSQL adapter (Railway internal URL)
- Health check: `/api/health`
- PORT / AUTH_URL 자동 처리

### 배포가 오래된 커밋에 멈춘 경우

GitHub `BlueStarAcademy/ykgame` `master` 최신 커밋과 Railway Deployments의 커밋이 다르면, 서비스가 **다른 저장소/브랜치**에 연결된 것입니다.

1. **ykgame-web** → **Settings** → **Source** 확인
   - Repository: `BlueStarAcademy/ykgame`
   - Branch: `master`
   - Root Directory: `/` (비어 있거나 루트)
2. **Disconnect** 후 같은 repo/branch로 **다시 Connect**
3. Railway 대시보드에서 `Ctrl+K` (Mac: `Cmd+K`) → **Deploy Latest Commit** 실행
4. GitHub → **Settings** → **Applications** → **Railway** → `BlueStarAcademy/ykgame` 접근 권한 확인
5. 배포 로그에 `Railway git repo: BlueStarAcademy/ykgame` / `Railway git commit: ...` 가 보이는지 확인

> `Redeploy`는 **같은 커밋**을 다시 빌드합니다. 최신 GitHub 코드를 받으려면 push 후 자동 배포 또는 **Deploy Latest Commit**이 필요합니다.

---

## 로컬 실행 (Railway Postgres 공유)

```bash
npm install
cp .env.example .env   # DATABASE_PUBLIC_URL 입력
npm run dev
```

`.env` 예시:

```env
DATABASE_PUBLIC_URL="postgresql://...@xxx.proxy.rlwy.net:PORT/railway"
DATABASE_URL="postgresql://...@postgres.railway.internal:5432/railway"
AUTH_SECRET="local-dev-secret"
AUTH_URL="http://localhost:3000"
```

로컬에서는 `DATABASE_PUBLIC_URL`이 자동 사용됩니다.

```bash
npx prisma migrate deploy   # 최초 1회
npm run db:seed               # 최초 1회 (선택)
npm run dev
```

---

## 환경 변수

| 변수 | 로컬 | Railway |
|------|------|---------|
| `DATABASE_PUBLIC_URL` | Public URL | 불필요 |
| `DATABASE_URL` | internal URL (참고용) | `${{Postgres.DATABASE_URL}}` |
| `AUTH_SECRET` | 직접 입력 | 직접 입력 (필수) |
| `AUTH_URL` | `http://localhost:3000` | 자동 (`RAILWAY_PUBLIC_DOMAIN`) |

자세한 Railway Variables 예시: [`railway.env.example`](railway.env.example)

---

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
