// blocks/tutorial.js
const getTutorialBlocks = () => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*아즈니섬 주문봇 사용 가이드* 📝',
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '다음 명령어들을 사용할 수 있습니다:',
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '• `/아즈니섬 주문시작` - 새로운 주문 세션을 시작합니다\n• `/아즈니섬 주문마감` - 현재 진행 중인 주문을 마감하고 주문 내역을 보여줍니다\n• `/아즈니섬 도움말` - 이 도움말을 보여줍니다',
    },
  },
  {
    type: 'divider',
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*주문 과정 예시:*',
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: "1️⃣ `/아즈니섬 주문시작` 명령어로 주문 세션을 시작합니다\n2️⃣ '주문하기' 버튼을 클릭하여 메뉴를 입력합니다\n3️⃣ 모든 주문이 완료되면 `/아즈니섬 주문마감` 명령어로 주문을 마감합니다",
    },
  },
];

const errorMessages = {
  activeSession:
    '이미 진행 중인 주문이 있습니다. 먼저 `/아즈니섬 주문마감` 명령어로 현재 주문을 마감해주세요.',
  noActiveSession:
    '현재 진행 중인 주문이 없습니다. `/아즈니섬 주문시작` 명령어로 새로운 주문을 시작해주세요.',
};

module.exports = {
  getTutorialBlocks,
  errorMessages,
};
