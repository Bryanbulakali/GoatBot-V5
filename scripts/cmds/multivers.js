const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "multivers",
    aliases: ["multi"],
    version: "1.0",
    author: "Bryan",
    countDown: 5,
    role: 0,
    shortDescription: "Quiz sur différents mangas du monde",
    longDescription: "Lance un quiz avec des questions de mangas variés (tirées de multivers.json)",
    category: "game",
    guide: {
      en: "{pn} pour lancer le quiz\nEnvoyez !start pour commencer\nEnvoyez !stop pour arrêter"
    }
  },

  onStart: async function ({ message, event, args, commandName, getLang }) {
    const filePath = path.join(__dirname, "data", "multivers.json");
    if (!fs.existsSync(filePath)) {
      return message.reply("❌ Le fichier multivers.json est introuvable.");
    }

    const questions = JSON.parse(fs.readFileSync(filePath, "utf8"));
    let quizRunning = false;
    let currentQuestion = 0;
    let score = {};
    let players = new Set();

    const sendQuestion = () => {
      if (currentQuestion >= questions.length) {
        quizRunning = false;
        let ranking = Object.entries(score).sort((a, b) => b[1] - a[1]);
        let resultText = "🏆 Fin du quiz Multivers ! Résultats :\n\n";
        ranking.forEach(([player, pts], i) => {
          resultText += `${i + 1}. ${player} - ${pts} points\n`;
        });
        message.reply(resultText);
        return;
      }
      const q = questions[currentQuestion];
      message.reply(`❓ **Question ${currentQuestion + 1}**\n${q.question}`);
    };

    message.reply("🎯 Bienvenue dans le **Quiz Multivers** !\nEnvoyez `!start` pour commencer ou `!stop` pour arrêter.");
    
    const listener = message.reply;

    global.GoatBot.onReply.set(event.threadID, {
      commandName,
      messageID: event.messageID,
      handler: async ({ body, senderID, name }) => {
        if (body.toLowerCase() === "!start" && !quizRunning) {
          quizRunning = true;
          currentQuestion = 0;
          score = {};
          players.clear();
          message.reply("🚀 Le quiz commence !");
          sendQuestion();
        } 
        else if (body.toLowerCase() === "!stop" && quizRunning) {
          quizRunning = false;
          message.reply("🛑 Quiz arrêté !");
        } 
        else if (quizRunning) {
          const q = questions[currentQuestion];
          let correctAnswers = Array.isArray(q.answer) ? q.answer.map(a => a.toLowerCase()) : [q.answer.toLowerCase()];
          if (correctAnswers.includes(body.toLowerCase())) {
            score[name] = (score[name] || 0) + 1;
            players.add(name);
            message.reply(`✅ Bonne réponse ${name} !\nScore: ${score[name]} pts`);
            currentQuestion++;
            sendQuestion();
          }
        }
      }
    });
  }
};
