const redis = require('./redis');

class OrderSession {
  constructor() {
    this.keyPrefix = 'order_session:';
  }

  // 세션 키 생성
  getSessionKey(channelId) {
    return `${this.keyPrefix}${channelId}`;
  }

  // 새 세션 시작
  async startSession(channelId, messageTs) {
    const sessionKey = this.getSessionKey(channelId);
    const exists = await this.isActiveSession(channelId);
    
    if (exists) {
      return false;
    }

    const session = {
      messageTs,
      orders: [],
      startTime: new Date().toISOString(),
      status: 'active'
    };

    await redis.set(sessionKey, JSON.stringify(session));
    // 24시간 후 자동 삭제
    await redis.expire(sessionKey, 24 * 60 * 60);
    
    return true;
  }

  // 세션 종료
  async endSession(channelId) {
    const sessionKey = this.getSessionKey(channelId);
    const session = await this.getSession(channelId);
    
    if (!session || session.status !== 'active') {
      return false;
    }

    session.status = 'completed';
    await redis.set(sessionKey, JSON.stringify(session));
    return true;
  }

  // 활성 세션 확인
  async isActiveSession(channelId) {
    const session = await this.getSession(channelId);
    return session && session.status === 'active';
  }

  // 주문 추가
  async addOrder(channelId, order) {
    const sessionKey = this.getSessionKey(channelId);
    const session = await this.getSession(channelId);
    
    if (!session || session.status !== 'active') {
      return false;
    }

    session.orders.push(order);
    await redis.set(sessionKey, JSON.stringify(session));
    return true;
  }

  // 세션 정보 가져오기
  async getSession(channelId) {
    const sessionKey = this.getSessionKey(channelId);
    const data = await redis.get(sessionKey);
    return data ? JSON.parse(data) : null;
  }

  // 세션 삭제
  async clearSession(channelId) {
    const sessionKey = this.getSessionKey(channelId);
    await redis.del(sessionKey);
  }
}

module.exports = new OrderSession();