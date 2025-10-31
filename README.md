# 점심 주문 슬랙 봇 (Lunch Order Slack Bot)

매일 정오에 자동으로 점심 주문을 받고, 주문 내역을 관리하는 슬랙 봇입니다.

## 주요 기능

- 매일 평일 정오 12시에 자동으로 주문 메시지 전송
- 메뉴 선택 (가정식, 프레시밀)
- 오후 2시 자동 주문 마감
- `/주문내역` 커맨드로 당일 주문 현황 조회

## 필요한 것

- Node.js 18 이상
- Slack Workspace 관리자 권한

## Slack 앱 설정 가이드

### 1. Slack 앱 생성

1. [Slack API 페이지](https://api.slack.com/apps)에 접속
2. **Create New App** 클릭
3. **From scratch** 선택
4. App Name 입력 (예: "점심주문봇")
5. Workspace 선택

### 2. Bot Token Scopes 설정

**OAuth & Permissions** 메뉴로 이동하여 다음 스코프를 추가:

- `chat:write` - 메시지 전송
- `commands` - 슬래시 커맨드 사용
- `channels:history` - 채널 메시지 읽기
- `channels:read` - 채널 정보 읽기

### 3. Socket Mode 활성화

1. **Socket Mode** 메뉴로 이동
2. **Enable Socket Mode** 활성화
3. App-Level Token 생성 (토큰 이름: `socket_token`)
4. Scope: `connections:write` 추가
5. 생성된 토큰 저장 (SLACK_APP_TOKEN으로 사용)

### 4. Slash Command 생성

**Slash Commands** 메뉴에서 다음 커맨드들을 생성:

#### `/주문시작`
- **Command**: `/주문시작`
- **Request URL**: (Socket Mode 사용으로 비워둠)
- **Short Description**: `즉시 주문 받기 시작`

#### `/주문내역`
- **Command**: `/주문내역`
- **Request URL**: (Socket Mode 사용으로 비워둠)
- **Short Description**: `오늘의 점심 주문 내역 조회`

#### `/식사도착`
- **Command**: `/식사도착`
- **Request URL**: (Socket Mode 사용으로 비워둠)
- **Short Description**: `식사 도착 알림 전송`

### 5. Interactivity 활성화

1. **Interactivity & Shortcuts** 메뉴로 이동
2. **Interactivity** 활성화
3. Request URL은 Socket Mode 사용으로 비워둠

### 6. 워크스페이스에 앱 설치

1. **Install App** 메뉴로 이동
2. **Install to Workspace** 클릭
3. 권한 승인
4. Bot User OAuth Token 저장 (SLACK_BOT_TOKEN으로 사용)

### 7. 채널 ID 확인

1. 슬랙에서 봇이 메시지를 보낼 채널 선택
2. 채널 이름 클릭 → 하단의 채널 ID 복사
3. 또는 채널에서 우클릭 → **View channel details** → 맨 하단에 채널 ID 확인

### 8. 봇을 채널에 초대

해당 채널에서:
```
/invite @점심주문봇
```

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 `.env`로 복사하고 필요한 값을 입력:

```bash
cp .env.example .env
```

`.env` 파일 예시:
```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_CHANNEL_ID=C1234567890
TZ=Asia/Seoul
```

### 3. 빌드

```bash
npm run build
```

### 4. 실행

```bash
npm start
```

개발 모드 (TypeScript 직접 실행):
```bash
npm run dev
```

## 사용 방법

### 자동 주문 메시지

- 매일 평일 정오 12시에 자동으로 주문 메시지가 전송됩니다
- 버튼을 클릭하여 원하는 메뉴를 선택하세요
- 오후 2시에 자동으로 주문이 마감됩니다

### 수동 주문 시작

정오 이전이나 특정 시간에 바로 주문을 시작하고 싶을 때:
```
/주문시작
```

- 평일에만 사용 가능합니다
- 이미 그날 주문 메시지가 전송된 경우 중복 전송되지 않습니다
- 수동으로 시작한 경우 정오 12시의 자동 메시지는 전송되지 않습니다

### 주문 내역 조회

채널에서 다음 커맨드를 입력:
```
/주문내역
```

선택 버튼이 표시됩니다:
- **📅 오늘** - 오늘의 주문 내역 (메뉴별 수량, 사용자별 주문)
- **📆 이번주** - 일요일부터 토요일까지의 주문
  - 전체 요약 (총 주문 수, 참여 인원, 메뉴별 합계)
  - 사용자별 주문 현황 (누가 몇 개 주문했는지)
  - 날짜별 집계
- **📆 이번달** - 이번 달 전체 주문
  - 전체 요약 및 사용자별 주문 현황
  - 날짜별 집계

#### 직접 입력 조회
특정 날짜나 기간을 직접 입력할 수도 있습니다:

**특정 날짜 조회:**
```
/주문내역 2025-10-30
```

**기간 지정 조회:**
```
/주문내역 2025-10-01~2025-10-31
```
원하는 기간의 전체 통계와 사용자별, 날짜별 집계를 확인할 수 있습니다.

### 식사 도착 알림

식사가 도착했을 때 알림 메시지를 보냅니다:
```
/식사도착
```

- 채널에 식사 도착 알림 메시지 전송
- 누구나 어느 채널에서든 사용 가능

## 프로젝트 구조

```
launch_bot/
├── src/
│   ├── index.ts                    # 메인 엔트리 포인트
│   ├── bot.ts                      # Slack Bot 초기화
│   ├── scheduler.ts                # 스케줄링 로직
│   ├── handlers/
│   │   ├── orderMessage.ts         # 주문 메시지 전송
│   │   ├── orderInteraction.ts     # 주문 버튼 클릭 처리
│   │   ├── startCommand.ts         # /주문시작 커맨드
│   │   ├── queryCommand.ts         # /주문내역 커맨드
│   │   └── deliveryCommand.ts      # /식사도착 커맨드
│   ├── storage/
│   │   └── orders.ts               # 주문 데이터 저장/조회
│   └── utils/
│       └── time.ts                 # 시간 관련 유틸리티
├── data/
│   └── orders.json                 # 주문 데이터 (자동 생성)
├── .env                            # 환경 변수 (직접 생성)
└── package.json
```

## 데이터 저장

주문 데이터는 `data/orders.json` 파일에 JSON 형식으로 저장됩니다.

구조 예시:
```json
{
  "2025-10-30": {
    "orders": [
      {
        "userId": "U123456",
        "userName": "홍길동",
        "menu": "가정식",
        "timestamp": "2025-10-30T12:30:00+09:00"
      }
    ],
    "closed": false
  }
}
```

## 배포 (Cloudtype)

이 프로젝트는 GitHub Actions를 통해 Cloudtype에 자동으로 배포됩니다.

### 배포 설정

#### 1. Cloudtype 프로젝트 생성

1. [Cloudtype](https://cloudtype.io/)에 로그인
2. 새 프로젝트 생성
3. 스페이스와 프로젝트 이름 확인

#### 2. GitHub Secrets 설정

Repository Settings → Secrets and variables → Actions에서 다음 secrets를 추가:

**필수 Secrets:**
- `CLOUDTYPE_TOKEN`: Cloudtype API 키
  - Cloudtype 대시보드 → 설정 → API 키에서 발급
- `GHP_TOKEN`: GitHub Personal Access Token
  - GitHub Settings → Developer settings → Personal access tokens
  - 권한: `repo`, `admin:public_key`

**Cloudtype 환경 변수 (Cloudtype 대시보드에서 설정):**
- `slack-bot-token`: Slack Bot User OAuth Token
- `slack-app-token`: Slack App-Level Token
- `slack-signing-secret`: Slack Signing Secret
- `slack-channel-id`: 주문 메시지를 보낼 채널 ID

#### 3. 워크플로우 설정 수정

`.github/workflows/deploy.yml` 파일에서 프로젝트 이름 수정:

```yaml
project: your-space-name/launch-bot  # 실제 스페이스명/프로젝트명으로 변경
```

#### 4. 자동 배포

`main` 브랜치에 push하면 자동으로 배포가 시작됩니다:

```bash
git push origin main
```

Actions 탭에서 배포 진행 상황을 확인할 수 있습니다.

### 배포 환경

- Node.js 20
- 빌드 명령: `npm ci && npm run build`
- 실행 명령: `npm start`
- 타임존: Asia/Seoul

## 문제 해결

### 봇이 메시지를 보내지 않아요
- 봇이 채널에 초대되었는지 확인
- `.env` 파일의 `SLACK_CHANNEL_ID`가 올바른지 확인
- Bot Token Scopes에 `chat:write` 권한이 있는지 확인

### 슬래시 커맨드가 작동하지 않아요
- Socket Mode가 활성화되어 있는지 확인
- Slash Commands 메뉴에서 `/주문내역` 커맨드가 등록되어 있는지 확인
- Bot Token Scopes에 `commands` 권한이 있는지 확인

### 버튼을 클릭해도 반응이 없어요
- Interactivity & Shortcuts가 활성화되어 있는지 확인
- Socket Mode가 올바르게 설정되어 있는지 확인

## 라이선스

MIT
