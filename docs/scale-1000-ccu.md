# 1,000 CCU DB pool / PgBouncer 운영 가이드

이 문서는 설정 절차만 정의한다. Railway 서비스와 PgBouncer를 실제로
프로비저닝하지는 않는다.

## 인증 부하 테스트

부하 테스트는 전용 staging 프로젝트와 전용 테스트 계정만 사용한다. 운영
사용자 비밀번호나 세션을 스크립트, 셸 기록, CI 로그, 문서에 저장하지 않는다.
테스트 계정은 앱의 정상 signup/admin 운영 절차로 미리 만들며 DB를 직접
수정하거나 reset/seed/delete하지 않는다.

1. staging에서 테스트 계정을 필요한 수만큼 생성하고 로그인한다.
2. 브라우저 개발자 도구의 해당 staging 요청에서 `Cookie` 헤더 문자열을
   복사한다. 쿠키 만료 시 새로 로그인해 교체한다.
3. 각 VU에 독립 계정을 쓰는 것이 권장된다. 쿠키 수가 VU보다 적으면
   `(VU - 1) % cookieCount`로 안정적으로 재사용되므로 사용자별 dump 제한과
   데이터 경합이 의도보다 커진다.
4. 아래 형식의 환경 변수로만 전달한다.

```text
K6_SESSION_COOKIES_JSON=["authjs.session-token=...","authjs.session-token=..."]
```

단일 `K6_SESSION_COOKIE`는 로컬 개발 smoke 전용이다. 두 변수가 모두 없거나
JSON이 빈 배열/문자열 아닌 값을 포함하면 preflight와 k6 setup이 즉시
실패한다. preflight는 대상 URL과 세션 개수만 출력하며 쿠키 값은 출력하지
않는다.

Linux/macOS:

```bash
export K6_BASE_URL=http://localhost:3000
export K6_SESSION_COOKIES_JSON='["authjs.session-token=..."]'
npm run load:check
npm run load:smoke
npm run load:mixed
```

Windows PowerShell:

```powershell
$env:K6_BASE_URL = "http://localhost:3000"
$env:K6_SESSION_COOKIES_JSON = '["authjs.session-token=..."]'
npm run load:check
npm run load:smoke
npm run load:mixed
```

`load:smoke`는 짧은 stage/soak와 최대 10 VU, 2 VU burst로 설정한다.
`load:mixed`는 100→300→500→1,000 VU ramp 뒤 기본 60분 soak를 수행한다.
`K6_SOAK_DURATION`, `K6_STAGE_DURATION`, `K6_BURST_START_TIME`,
`K6_BURST_DURATION`, `K6_THINK_TIME_SECONDS`로 승인된 시험 계획에 맞게
조정할 수 있다. 별도 200 VU executor는 요청당 최대 20 dump chunk를 보내고
429를 정상적인 rate-limit 관측값으로 집계한다. mixed workload에서 발생한
429와 그 밖의 4xx/5xx는 일반 실패다.

`*.railway.app` 또는 `K6_TARGET_ENV=production` 대상은 기본 차단된다. 운영
부하 시험 변경 승인이 있는 경우에만 실행 셸에서
`K6_ALLOW_PRODUCTION=true`를 명시한다. 이 값은 운영 시험이 안전하다는
보장이 아니라 실수 방지 gate 해제일 뿐이다.

## 연결 분리

Railway 웹 서비스에 다음 Reference를 설정한다.

- `DATABASE_URL`: 애플리케이션 런타임 연결. PgBouncer 도입 전에는 Postgres
  원본 URL, 도입 후에는 **transaction pooling** 모드의 PgBouncer URL이다.
- `DIRECT_DATABASE_URL`: 항상 Railway Postgres 원본 URL이다. PgBouncer를
  경유하지 않는다.

`npm run db:migrate`, `npm run db:deploy`, `npm run db:reset`과 Railway
pre-deploy는 `DIRECT_DATABASE_URL`이 있으면 Prisma CLI 자식 프로세스에만
이를 `DATABASE_URL`로 전달한다. 값이 없으면 기존 `DATABASE_URL`로
fallback한다. seed와 실제 앱 런타임은 계속 런타임 URL을 사용한다.

Railway 빌드는 `railway.toml`의 로컬 placeholder URL로 `prisma generate`와
Next.js build를 수행한다. migration wrapper는 빌드에 사용되지 않으므로 이
동작은 유지된다.

## PgBouncer 설정

1. Postgres와 같은 Railway private network에 PgBouncer 서비스를 둔다.
2. pool mode를 `transaction`으로 설정한다.
3. PgBouncer의 upstream은 Postgres 원본 private URL로 설정한다.
4. 웹 서비스 `DATABASE_URL`만 PgBouncer private URL로 교체한다.
5. `DIRECT_DATABASE_URL`은 Postgres 원본 URL로 유지한다.
6. pre-deploy 로그에서 `DIRECT_DATABASE_URL을 migration 전용 연결로
   사용합니다.`를 확인한다.
7. `/api/health`에서 DB 응답과 bounded pool 설정을 확인하고 reward API
   replay/concurrency smoke test를 수행한다.

URL은 로그나 문서에 직접 붙여 넣지 않는다. Railway Reference로 전달하고
비밀번호가 노출되면 즉시 credential을 rotate한다.

## 연결 예산

Postgres의 `max_connections`에서 migration, Railway 관리 작업, 수동 점검용
reserve를 먼저 뺀다.

```text
app_budget = max_connections - operations_reserve
replica_count * DATABASE_POOL_MAX <= app_budget
```

예를 들어 `max_connections=100`, reserve `20`, replica `4`라면 앱 인스턴스
당 `DATABASE_POOL_MAX=20`으로 총 80개다. PgBouncer의 upstream server pool
합계도 80 이하로 제한한다. replica를 늘릴 때 pool max를 함께 낮추지 않으면
안 된다.

애플리케이션 설정 범위:

- `DATABASE_POOL_MAX`: 기본 20, 5~50
- `DATABASE_POOL_CONNECTION_TIMEOUT_MS`: 기본 5,000, 1,000~30,000
- `DATABASE_POOL_IDLE_TIMEOUT_MS`: 기본 30,000, 1,000~300,000

범위 밖 정수는 clamp되고 빈 값/비수치는 기본값으로 돌아간다. 먼저 낮은
pool로 시작하고 `/api/health`의 `waiting`, DB 연결 수, API 지연을 함께
관찰해 조정한다.

## transaction pooling 호환성

RewardEvent per-event lock, reward rate lock, 기존 시즌 coupon quota lock은
모두 `pg_advisory_xact_lock`을 사용한다. 이 lock은 현재 transaction 종료와
함께 해제되므로 transaction pooling과 호환된다. `pg_advisory_lock`,
`SET` 기반 세션 상태, 임시 테이블처럼 다음 요청에도 같은 DB 세션이
유지된다고 가정하는 코드를 추가하지 않는다.

메일 수령은 `claimedAt IS NULL` 조건부 갱신이 정확히 1행을 획득한 요청만
쿠폰/재화를 지급하며, claim과 지급은 같은 transaction에서 commit된다.
장비 강화는 user/game/part 단위 `pg_advisory_xact_lock` 뒤 현재 레벨과 비용을
다시 읽고, `currency >= cost` 조건의 `UPDATE ... RETURNING`으로 차감한다.
interactive transaction 안의 쿼리는 순차 실행하며 `Promise.all`로 같은
connection에 동시 쿼리를 보내지 않는다.

## 시즌 누적 통계 migration

`UserSeasonStats`는 `(userId, gameId, seasonKey)`별 점수·스타·플레이 시간을
미리 누적한다. score 신규 insert와 누적 upsert는 같은 transaction이며,
동일 `sessionId` replay는 기존 `GameScore`를 반환하고 누적하지 않는다.
Yanmar 누적 랭킹만 이 테이블을 사용하고 다른 게임의 best 랭킹은
`GameScore`를 계속 사용한다.

additive migration의 초기 backfill은 당시 `GameScore.monthKey` 문자열을
변환하지 않고 그대로 `seasonKey`로 group한다. 과거 월 키의 실제 분기 소속과
재처리 기준을 DB만으로 확정할 수 없기 때문이다. 따라서 다음 제약이 있다.

- migration 시점 이전 월 키(`YYYY-MM`)가 남아 있으면 분기 키 랭킹에 자동
  합산되지 않는다.
- migration 이후 앱의 `/api/scores` 쓰기만 `getSeasonKey()` 기준 누적을
  보장한다. 수동 `GameScore` insert/import는 통계도 함께 갱신해야 한다.
- 대량 재집계는 score 쓰기를 멈춘 maintenance window에서 수행하고 전후
  사용자 수와 합계를 검증한다.

월 키를 분기 키로 매핑하기로 운영상 확정한 경우 아래 형태로 재집계한다.
기존 행 삭제나 down migration은 자동화하지 않는다.

```sql
INSERT INTO "UserSeasonStats" (
  "id", "userId", "gameId", "seasonKey",
  "totalScore", "totalStars", "totalPlayTime", "updatedAt"
)
SELECT
  'manual_' || md5("userId" || ':' || "gameId" || ':' || normalized_key),
  "userId", "gameId", normalized_key,
  SUM(score)::int, SUM(stars)::int, SUM("playTime")::int, CURRENT_TIMESTAMP
FROM (
  SELECT gs.*,
    CASE
      WHEN "monthKey" ~ '^\d{4}-(0[1-9]|1[0-2])$'
      THEN substring("monthKey" from 1 for 4) || '-' ||
        ((((substring("monthKey" from 6 for 2))::int - 1) / 3) + 1)::text
      ELSE "monthKey"
    END AS normalized_key
  FROM "GameScore" gs
) normalized
GROUP BY "userId", "gameId", normalized_key
ON CONFLICT ("userId", "gameId", "seasonKey") DO UPDATE SET
  "totalScore" = EXCLUDED."totalScore",
  "totalStars" = EXCLUDED."totalStars",
  "totalPlayTime" = EXCLUDED."totalPlayTime",
  "updatedAt" = CURRENT_TIMESTAMP;
```

## 정적 캐시 경계

Next가 기본으로 관리하는 1년 immutable 정책은 해시된 `/_next/static`에만
적용하며, 개발 동작을 깨뜨릴 수 있는 custom header로 덮어쓰지 않는다.
`/images`와 `/icons`의 비해시 public asset은 기존 1일+SWR 정책을 유지하고,
`/games` HTML route에는 public cache header를 설정하지 않는다. service
worker는 버전별 static cache를 사용하며 same-origin `/_next/static`과
`/images`, `/icons`, `/games`의 확장자 있는 GET asset만 cache-first로
처리한다. HTML/API/auth/POST 응답은 영구 저장하지 않는다.

## Redis 공유 캐시와 dump 제한

Railway 웹 서비스에 Redis 서비스의 private URL을
`REDIS_URL=${{Redis.REDIS_URL}}` Reference로 설정한다. URL 원문은 로그나
문서에 남기지 않는다. `REDIS_PREFIX`는 기본 `ykgame`이며 모든 key는
prefix와 schema version을 포함한다. 사용자 ID는 key에 해시로만 포함된다.

애플리케이션 import/build만으로 연결하지 않고, Redis가 필요한 첫 요청에서만
연결한다. 연결과 명령에는 짧은 timeout 및 bounded reconnect가 적용된다.

- `REDIS_CONNECT_TIMEOUT_MS`: 기본 1,500ms, 250~5,000ms
- `REDIS_COMMAND_TIMEOUT_MS`: 기본 750ms, 100~3,000ms
- `REDIS_RECONNECT_ATTEMPTS`: 기본 3, 0~10
- `DUMP_RATE_LIMIT_CAPACITY`: 기본 20 chunks, 1~200
- `DUMP_RATE_LIMIT_REFILL_PER_SEC`: 기본 5 chunks/sec, 0.1~100

dump 신규 event는 사용자별 token bucket에서 `chunkCount`만큼 소비한다.
같은 `eventId`의 `RewardEvent` replay를 먼저 확인하므로 재시도는 토큰을
다시 소비하지 않는다. 신규 event가 잔여 토큰을 초과하면 429를 반환한다.

Redis가 미설정 또는 장애이면 reward DB 멱등 경로는 제한적 fail-open한다.
이 경우 구조화 API 로그의 `rateLimitBypassed=true`로 식별할 수 있다. TOP10
랭킹(20초)과 사용자 stats(20초)는 Redis 공유 캐시를 사용하고, Redis를 쓸 수
없을 때만 기존 프로세스 로컬 TTL 캐시로 fallback한다. score 저장 성공 시
해당 game/season TOP10과 사용자 stats key를 지우며 duplicate replay는
무효화하지 않는다.

## 배포와 롤백

배포 전:

1. `npm run test:scale`
2. `npm run lint`
3. `npx tsc --noEmit`
4. staging에서 direct migration과 runtime PgBouncer 연결을 각각 확인

문제가 생기면:

1. Redis 기능이 원인이면 웹 서비스의 `REDIS_URL` Reference를 제거하고
   재배포한다. 앱은 dump 제한 fail-open 및 로컬 랭킹 TTL로 돌아간다.
2. 필요하면 Redis 서비스 자체는 앱 롤백 확인 후 중지한다. URL/credential을
   로그에 붙여 넣지 않는다.
3. DB 연결이 원인이면 웹 서비스 `DATABASE_URL` Reference를 PgBouncer URL에서 기존 Postgres
   원본 URL로 되돌린다.
4. 재배포 또는 restart 후 `/api/health`와 핵심 reward API를 확인한다.
5. `DIRECT_DATABASE_URL`은 원래부터 direct이므로 변경하지 않는다.
6. pool 고갈이 원인이면 replica 수와 `DATABASE_POOL_MAX`를 연결 예산 안으로
   낮춘다.

스키마 migration 자체의 down migration은 이 연결 롤백과 별개다. destructive
schema rollback은 자동 수행하지 말고 데이터 호환성을 검토한 별도 migration으로
진행한다.

## 실제 인프라 생성 체크리스트

아래 항목은 문서 작성 완료 표시가 아니라 담당자가 Railway/공급자 화면에서
리소스를 실제 생성하고 증거 링크를 남긴 뒤 체크한다.

Redis:

- [ ] production과 분리된 staging Railway 프로젝트에 Redis 서비스를 생성
- [ ] web 서비스에 private `REDIS_URL` Reference 연결
- [ ] prefix, connect/command timeout, reconnect 횟수 확인
- [ ] 두 web replica에서 같은 ranking cache가 보이는지 확인
- [ ] Redis 중지 smoke로 fail-open과 `rateLimitBypassed=true` 로그 확인

PgBouncer:

- [ ] Postgres와 같은 private network에 PgBouncer 서비스 생성
- [ ] transaction pooling과 upstream private Postgres URL 설정
- [ ] runtime `DATABASE_URL`만 PgBouncer Reference로 전환
- [ ] `DIRECT_DATABASE_URL`은 원본 Postgres Reference로 유지
- [ ] 연결 예산 식과 PgBouncer client/server pool 상한을 기록
- [ ] migration, health, score replay, dump replay smoke 증거 첨부

CDN/edge:

- [ ] Railway custom domain과 TLS를 먼저 확인
- [ ] Railway 프로젝트에 독립 CDN 리소스가 제공되지 않는 경우 Cloudflare 등
      외부 CDN/proxy를 실제 생성하고 custom domain을 연결
- [ ] `/_next/static`만 장기 immutable cache인지 응답 헤더와 cache-hit로 확인
- [ ] `/api`, auth, HTML, POST가 CDN에 저장되지 않는지 확인
- [ ] 원본 우회 방지, purge 절차, 장애 시 DNS/프록시 롤백 담당자를 기록

web replica:

- [ ] 단일 인스턴스 기준 시험 결과와 배포 revision 저장
- [ ] Railway horizontal scaling에서 replica를 정확히 2로 변경
- [ ] 두 replica가 Ready이고 health revision이 동일한지 확인
- [ ] 총 DB pool과 PgBouncer upstream pool이 연결 예산 이내인지 재확인
- [ ] 세션, Redis cache, 멱등 replay가 replica 간 동일하게 동작하는지 확인

## 단일 인스턴스에서 2 replica 승인 순서

1. 변경 freeze와 staging revision을 기록하고 `npm run test:scale`, lint,
   typecheck를 통과시킨다.
2. 단일 인스턴스에서 preflight와 `npm run load:smoke`를 실행한다.
3. 같은 workload로 1,000 VU ramp/soak 기준선을 측정한다. 임계치 미달이면
   replica 변경으로 원인을 가리지 말고 먼저 병목과 오류를 기록한다.
4. DB 연결 예산, Redis/PgBouncer/CDN 체크리스트와 기준선 결과를 검토해
   2 replica 변경 승인을 받는다.
5. Railway replica를 2로 변경하고 health/revision/트래픽 분산을 확인한다.
6. 동일 k6 환경과 duration으로 smoke 후 mixed/soak를 반복한다.
7. 단일 대비 처리량, 지연, 오류, DB/Redis 부하를 비교해 유지 또는 rollback을
   승인한다. 실패 시 먼저 replica를 1로 되돌리고 health를 확인한다.

## 관측 지표와 합격 기준

k6 합격 기준은 전체 `http_req_failed < 1%`, `p95 < 300ms`,
`p99 < 1s`이다. dump/ranking/score custom Trend와 Rate도 같은 기준으로
확인한다. rate-limit 전용 dump burst의 429는 `dump_rate_limited`로 별도
집계되고 `http_req_failed`에서는 제외된다. mixed scenario의 429는
실패이므로 두 수치를 섞어 해석하지 않는다.

동시에 다음을 수집한다.

- Railway web replica별 CPU, memory, restart/OOM, request throughput
- API route별 p50/p95/p99, status, timeout, request ID와 배포 revision
- `/api/health` DB pool total/idle/waiting과 Postgres active connection
- PgBouncer active/waiting client, active/idle server, pool wait time
- Redis command latency/error/reconnect, ranking cache hit, memory/eviction
- dump 429 수와 비율, `rateLimitBypassed`, replay/duplicate 비율
- CDN cache hit ratio, origin bandwidth, 정적 asset p95

## 실행 결과 템플릿

```text
시험 ID / 일시:
승인자 / 실행자:
대상 환경 / URL(credential 제외):
git revision / Railway deployment:
replica: 1 | 2
k6 명령 및 비밀 제외 환경변수:
stage / soak / burst 설정:
인증 테스트 계정 수:

전체 요청 / 처리량:
http_req_failed:
p50 / p95 / p99:
dump p95 / p99 / failure / 429:
ranking p95 / p99 / failure:
score p95 / p99 / failure:

web CPU / memory / restart:
DB pool waiting / Postgres connections:
PgBouncer client wait / server pool:
Redis latency / error / eviction / bypass:
CDN hit ratio / origin bandwidth:

임계치 통과 여부:
단일 대비 2 replica 차이:
관측된 병목과 로그/대시보드 링크:
유지 또는 rollback 결정 / 승인자:
후속 작업:
```
