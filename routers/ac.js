const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

router.get("/account", async (req, res) => {
  const userHash = req.cookies.userHash;

  if (!userHash) {
    return res.status(401).json({ error: "Nie jesteś zalogowany" });
  }

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, nick, email, level, points")
      .eq("userHash", userHash)
      .single();
    console.log(user);
    if (error || !user) {
      res.clearCookie("userHash");
      res.clearCookie("userNick");
      return res.status(401).json({ error: "Sesja wygasła" });
    }

    res.json({
      user: {
        id: user.id,
        nick: user.nick,
        email: user.email,
        level: user.level,
        points: user.points,
      },
    });
  } catch (error) {
    console.error("Błąd pobierania danych konta:", error);
    res.status(500).json({ error: "Wystąpił błąd serwera" });
  }
});

module.exports = router;
