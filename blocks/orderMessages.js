const orderMessages = {
    start: {
      text: '아즈니섬 음료 주문 받습니다! ☕️🥤',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '☕️ *아즈니섬 음료 주문 받습니다!* 🥤\n아즈니섬 음료를 주문하실 분들은 아래 주문하기 버튼을 눌러주세요. :pepe-coffee:',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '주문하기',
                emoji: true,
              },
              style: 'primary',
              action_id: 'order_button',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '주문현황',
                emoji: true,
              },
              action_id: 'check_status_button'
            },
          ],
        },
      ]
    },
    withUserGroup: {
      text: (userGroupId) => `<!subteam^${userGroupId}> 아즈니섬 음료 주문 받습니다! ☕️🥤`,
      blocks: (userGroupId) => [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `️🥤 <!subteam^${userGroupId}> *아즈니섬 음료 주문 받습니다!* ☕️\n아즈니섬 음료를 주문하실 분들은 아래 주문하기 버튼을 눌러주세요. :pepe-coffee:`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '주문하기',
                emoji: true,
              },
              style: 'primary',
              action_id: 'order_button',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '주문현황',
                emoji: true,
              },
              action_id: 'check_status_button'
            },
          ],
        },
      ]
    },
    status: {
      text: '현재까지 주문된 메뉴들의 집계 현황입니다.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📊 주문 현황을 확인하세요!*\n주문이 잘 접수되었는지 궁금하시다면\n`/아즈니섬 주문현황` 명령어로 현재까지 주문된 메뉴들을 확인할 수 있습니다.',
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '💡 메뉴별로 정렬되어 보기 쉽게 보여드립니다'
            }
          ]
        }
      ]
    },
  };
  
  module.exports = {
    orderMessages
  };