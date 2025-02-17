const { App, VercelReceiver } = require('@slack/bolt');
const orderManager = require('../lib/orderSession');

const receiver = new VercelReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// 1. 주문 시작 명령어 처리
app.command('/주문시작', async ({ command, ack, client, respond }) => {
  await ack();

  try {
    // 이미 진행 중인 주문이 있는지 확인
    if (await orderManager.isActiveSession(command.channel_id)) {
      await respond({
        text: "이미 진행 중인 주문이 있습니다. 먼저 `/마감` 명령어로 현재 주문을 마감해주세요.",
        response_type: 'ephemeral'
      });
      return;
    }

    const result = await client.chat.postMessage({
      channel: command.channel_id,
      text: "오늘의 주문을 받습니다! 🍱",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*오늘의 주문*\n주문하실 분들은 아래 버튼을 눌러주세요."
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "주문하기",
                emoji: true
              },
              action_id: "order_button"
            }
          ]
        }
      ]
    });

    // 새 세션 시작
    await orderManager.startSession(command.channel_id, result.ts);

  } catch (error) {
    console.error('메시지 발송 실패:', error);
    await respond({
      text: "주문 시작 중 오류가 발생했습니다.",
      response_type: 'ephemeral'
    });
  }
});

// 2. 주문 모달 표시
app.action('order_button', async ({ body, ack, client, respond }) => {
  await ack();

  // 활성 세션 확인
  if (!await orderManager.isActiveSession(body.channel.id)) {
    await respond({
      text: "현재 진행 중인 주문이 없습니다. `/주문시작` 명령어로 새로운 주문을 시작해주세요.",
      response_type: 'ephemeral'
    });
    return;
  }

  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "order_submission",
        title: {
          type: "plain_text",
          text: "주문하기"
        },
        submit: {
          type: "plain_text",
          text: "주문"
        },
        blocks: [
          {
            type: "input",
            block_id: "menu",
            element: {
              type: "plain_text_input",
              action_id: "menu_input"
            },
            label: {
              type: "plain_text",
              text: "메뉴"
            }
          },
          {
            type: "input",
            block_id: "options",
            element: {
              type: "plain_text_input",
              action_id: "options_input",
              multiline: true
            },
            label: {
              type: "plain_text",
              text: "추가 요청사항"
            },
            optional: true
          }
        ],
        private_metadata: body.channel.id
      }
    });
  } catch (error) {
    console.error('모달 열기 실패:', error);
  }
});

// 3. 주문 접수 및 스레드 응답
app.view('order_submission', async ({ ack, body, view, client }) => {
  await ack();

  const channelId = view.private_metadata;
  const session = await orderManager.getSession(channelId);

  if (!session || !await orderManager.isActiveSession(channelId)) {
    console.error('주문 세션이 유효하지 않습니다');
    return;
  }

  const userId = body.user.id;
  const menu = view.state.values.menu.menu_input.value;
  const options = view.state.values.options.options_input.value;

  try {
    // 스레드에 주문 내용 추가
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: session.messageTs,
      text: `<@${userId}>님의 주문:\n*메뉴*: ${menu}\n*요청사항*: ${options || '없음'}`
    });

    // 주문 데이터 저장
    await orderManager.addOrder(channelId, {
      userId,
      menu,
      options
    });

  } catch (error) {
    console.error('주문 처리 실패:', error);
  }
});

// 4. 주문 마감 명령어 처리
app.command('/마감', async ({ command, ack, client, respond }) => {
  await ack();

  try {
    const session = await orderManager.getSession(command.channel_id);
    
    if (!session || !await orderManager.isActiveSession(command.channel_id)) {
      await respond({
        text: "현재 진행 중인 주문이 없습니다.",
        response_type: 'ephemeral'
      });
      return;
    }

    if (session.orders.length === 0) {
      await respond({
        text: "아직 접수된 주문이 없습니다.",
        response_type: 'ephemeral'
      });
      return;
    }

    // 주문 내역 정리
    let summary = "*오늘의 주문 내역*\n\n";
    for (const order of session.orders) {
      summary += `• <@${order.userId}>\n`;
      summary += `  - 메뉴: ${order.menu}\n`;
      if (order.options) {
        summary += `  - 요청사항: ${order.options}\n`;
      }
      summary += '\n';
    }

    // 스레드에 정리 내용 추가
    await client.chat.postMessage({
      channel: command.channel_id,
      thread_ts: session.messageTs,
      text: summary
    });

    // 채널에도 동일한 내용 표시
    await client.chat.postMessage({
      channel: command.channel_id,
      text: summary
    });

    // 세션 종료 및 삭제
    await orderManager.clearSession(command.channel_id);

  } catch (error) {
    console.error('마감 처리 실패:', error);
    await respond({
      text: "주문 마감 처리 중 오류가 발생했습니다.",
      response_type: 'ephemeral'
    });
  }
});

// Vercel 함수 핸들러
module.exports = async (req, res) => {
  await receiver.start();
  return await receiver.handleRequest(req, res);
};