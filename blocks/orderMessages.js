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
              action_id: 'order_button',
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
              action_id: 'order_button',
            },
          ],
        },
      ]
    }
  };
  
  module.exports = {
    orderMessages
  };