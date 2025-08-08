const fs = require("fs");
const path = require("path");

const activeSessions = {};

module.exports = {
  config: {
    name: "multivers",
    aliases: ["multi"],
    role: "0",
    author: "Merdi Madimba or Bryan Bulakali",
    version: "2.0",
    description: "Quiz sur différents mangas du multivers depuis multivers.json avec réponses multiples",
    category: "🎮 Jeu"
  },

  onStart: async function ({ event, message }) {
    const threadID = event.threadID;

    if (activeSessions[threadID]) {
      return message.reply("❗ Un quiz est déjà en cours !");
    }

    await message.send(
      "🎯 Prêt pour le **Quiz Multivers** ?\n\nTapez `!start` pour commencer et `!stop` pour arrêter."
    );

    activeSessions[threadID] = { status: "waiting" };
  },

  onChat: async function ({ event, message, usersData }) {
    const threadID = event.threadID;
    const session = activeSessions[threadID];

    if (!session) return;

    const normalize = str =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // STOP - Arrêt immédiat du quiz
    if (event.body.toLowerCase() === "!stop") {
      if (session.timeoutID) {
        clearTimeout(session.timeoutID);
      }
      delete activeSessions[threadID];
      return message.reply("🛑 Quiz arrêté.");
    }

    // START
    if (session.status === "waiting" && event.body.toLowerCase() === "!start") {
      let filePath = path.join(__dirname, "..", "data", "multivers.json");

      if (!fs.existsSync(filePath)) {
        delete activeSessions[threadID];
        return message.reply("❌ Fichier multivers.json introuvable.");
      }

      let questions;
      try {
        questions = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (e) {
        delete activeSessions[threadID];
        return message.reply("❌ Erreur de lecture dans multivers.json");
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        delete activeSessions[threadID];
        return message.reply("❌ Aucune question trouvée dans multivers.json.");
      }

      const selected = [...questions].sort(() => Math.random() - 0.5).slice(0, 30);
      const scores = {};
      let currentIndex = 0;
      let currentQuestion = null;
      let answered = false;

      // Stocke timeoutID dans session pour pouvoir clear à l'arrêt
      session.timeoutID = null;

      const sendQuestion = async () => {
        // Si session supprimée ou arrêtée, on stoppe tout
        if (!activeSessions[threadID]) return;

        if (currentIndex >= selected.length) {
          const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          let result = "🏁 Fin du quiz Multivers ! Résultat final :\n";
          for (let [name, score] of sorted) {
            result += `🏅 ${name} : ${score} pts\n`;
          }
          result += `👑 Vainqueur : ${sorted[0]?.[0] || "Aucun"}`;
          await message.send(result);
          delete activeSessions[threadID];
          return;
        }

        answered = false;
        currentQuestion = selected[currentIndex];
        await message.send(`❓ Question ${currentIndex + 1} : ${currentQuestion.question}`);

        session.timeoutID = setTimeout(async () => {
          if (!answered && activeSessions[threadID]) {
            const correct =
              Array.isArray(currentQuestion.answer) ? currentQuestion.answer[0] : currentQuestion.answer;
            await message.send(`⏰ Temps écoulé ! La bonne réponse était : ${correct}`);
            currentIndex++;
            sendQuestion();
          }
        }, 10000);
      };

      activeSessions[threadID] = {
        status: "playing",
        timeoutID: null,
        handler: async ({ event, message, usersData }) => {
          if (!currentQuestion || answered) return;

          const senderName = await usersData.getName(event.senderID);
          const msg = event.body || "";
          const userAnswer = normalize(msg);

          const expectedAnswers = Array.isArray(currentQuestion.answer)
            ? currentQuestion.answer.map(normalize)
            : [normalize(currentQuestion.answer)];

          if (expectedAnswers.includes(userAnswer)) {
            answered = true;
            clearTimeout(session.timeoutID);
            session.timeoutID = null;

            scores[senderName] = (scores[senderName] || 0) + 10;

            let board = "📊 Score actuel :\n";
            for (let [name, pts] of Object.entries(scores)) {
              board += `🏅 ${name} : ${pts} pts\n`;
            }

            await message.reply(`✅ Bonne réponse de ${senderName} !\n\n${board}`);
            currentIndex++;
            setTimeout(sendQuestion, 1000);
          }
        }
      };

      sendQuestion();
      return;
    }

    // Pendant le quiz
    if (session.status === "playing" && typeof session.handler === "function") {
      session.handler({ event, message, usersData });
    }
  }
};
