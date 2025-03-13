const { createClient } = require("@supabase/supabase-js");

class SessionManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    this.sessions = new Map();
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 godziny w milisekundach
    this.userCache = new Map();
    this.userCacheTimeout = 5 * 60 * 1000;
    this.authCache = new Map();
    this.authCacheTimeout = 60 * 1000;

    // Uruchom czyszczenie nieaktywnych sesji co godzinę
    setInterval(() => this.cleanInactiveSessions(), 60 * 60 * 1000);
  }

  async checkAuth(userHash) {
    const now = Date.now();
    const cached = this.authCache.get(userHash);

    if (cached && now - cached.timestamp < this.authCacheTimeout) {
      return cached.user;
    }

    const { data: user, error } = await this.supabase
      .from("users")
      .select("id, nick, level, points, color, premium")
      .eq("userHash", userHash)
      .single();

    if (!error && user) {
      this.authCache.set(userHash, {
        user,
        timestamp: now,
      });
    }

    return user;
  }

  async getUserData(userHash) {
    try {
      // Sprawdź cache
      const cachedUser = this.userCache.get(userHash);
      if (
        cachedUser &&
        Date.now() - cachedUser.timestamp < this.userCacheTimeout
      ) {
        return cachedUser.data;
      }

      const { data: user, error } = await this.supabase
        .from("users")
        .select("id, nick, level, points, premium")
        .eq("userHash", userHash)
        .single();

      if (error || !user) {
        console.error("Błąd pobierania danych użytkownika:", error);
        return null;
      }

      // Zapisz do cache
      this.userCache.set(userHash, {
        data: user,
        timestamp: Date.now(),
      });

      return user;
    } catch (error) {
      console.error("Błąd SessionManager:", error);
      return null;
    }
  }

  async createSession(userHash) {
    const userData = await this.getUserData(userHash);
    if (userData) {
      this.sessions.set(userHash, {
        ...userData,
        lastActivity: Date.now(),
      });
      return userData;
    }
    return null;
  }

  trackSession(userHash, lastActivity = Date.now()) {
    const existingSession = this.sessions.get(userHash);
    this.sessions.set(userHash, {
      ...existingSession,
      lastActivity: lastActivity,
    });
  }

  updateActivity(userHash) {
    const session = this.sessions.get(userHash);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  cleanInactiveSessions() {
    const now = Date.now();
    let cleaned = 0;

    // Czyść nieaktywne sesje
    for (const [userHash, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.sessions.delete(userHash);
        this.userCache.delete(userHash); // Wyczyść też cache
        cleaned++;
      }
    }

    // Czyść stary cache
    for (const [userHash, cache] of this.userCache.entries()) {
      if (now - cache.timestamp > this.userCacheTimeout) {
        this.userCache.delete(userHash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(
        `[SessionManager] Wyczyszczono ${cleaned} nieaktywnych sesji i cache`
      );
    }
  }

  getSession(userHash) {
    const session = this.sessions.get(userHash);
    if (session) {
      this.updateActivity(userHash);
    }
    return session;
  }

  removeSession(userHash) {
    this.sessions.delete(userHash);
  }

  getAllSessions() {
    return this.sessions;
  }

  getSessionsCount() {
    return this.sessions.size;
  }

  getActiveSessionsInfo() {
    const now = Date.now();
    const sessionsInfo = [];

    for (const [userHash, session] of this.sessions.entries()) {
      const inactiveTime = Math.round((now - session.lastActivity) / 1000 / 60);
      sessionsInfo.push({
        userHash,
        lastActivity: inactiveTime,
        ...session,
      });
    }

    return sessionsInfo;
  }
}

module.exports = new SessionManager();
