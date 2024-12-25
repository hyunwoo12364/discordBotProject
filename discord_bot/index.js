const fs = require('fs');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// 봇 토큰
const TOKEN = 'MTI4NzQxMzgwNjUxOTE1Njg5Ng.GEZelQ.Ohd2PKTcLY6hQf9YfpELJoKhxn_MLkY8Md6T_g';

// 데이터 저장 파일
const DATA_FILE = 'user_data.json';

// 데이터 로드 함수
function loadUserData() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } else {
        return {};
    }
}

// 데이터 저장 함수
function saveUserData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
}

// 유저 데이터 객체
let userData = loadUserData();

const diceCooldowns = new Map();
// 현재 진행 중인 문제를 저장
let currentProblem = {};

// 봇 준비 완료 이벤트
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// 메시지 이벤트 핸들러
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // 봇의 메시지 무시

    const userId = message.author.id;

    // 유저 데이터가 없으면 초기화
    if (!userData[userId]) {
        userData[userId] = {
            username: message.author.username,
            messageCount: 0,
            lastMessage: null,
            money: 10000
        };
        saveUserData(userData); // 새 데이터를 저장
    }

    // 돈이 0원보다 작으면 0원으로 고정
    if (userData[userId].money < 0) {
        userData[userId].money = 0;
        saveUserData(userData);
    }

    // 명령어 제외 처리
    if (!message.content.startsWith('!')) {
        // 메시지 카운트 증가 및 마지막 메시지 저장
        userData[userId].messageCount++;
        userData[userId].lastMessage = message.content;

        // 데이터 저장
        saveUserData(userData);
    }

    // 명령어 처리
    if (message.content === '!내정보') {
        const stats = userData[userId];
        await message.reply(
            `Your stats:\n- 유저이름: ${stats.username}\n- 보낸 메세지수: ${stats.messageCount}\n- 마지막으로 보낸 메세지: ${stats.lastMessage || 'No message recorded.'}\n- 돈: ${stats.money}`
        );
    } else if (message.content === '!help') {
        await message.reply('Commands: !내정보, !help, !주사위, !일, !가위바위보');
    } else if (message.content.startsWith('!가위바위보')||message.content.startsWith('!ㄱㅂㅂ')) {
        const stats = userData[userId];
        const args = message.content.split(' ');

        if (args.length < 2) {
            await message.reply('사용법: !가위바위보 [베팅 금액]');
            return;
        }

        const betAmount = parseInt(args[1]);

        if (isNaN(betAmount) || betAmount <= 0) {
            await message.reply('베팅 금액은 0보다 큰 숫자여야 합니다.');
            return;
        }

        if (stats.money < betAmount) {
            await message.reply('보유한 돈이 부족합니다.');
            return;
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rock')
                    .setLabel('🪨 바위')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('scissors')
                    .setLabel('✂️ 가위')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('paper')
                    .setLabel('📜 보')
                    .setStyle(ButtonStyle.Primary)
            );

        const botChoice = ['rock', 'scissors', 'paper'][Math.floor(Math.random() * 3)];

        const sentMessage = await message.reply({
            content: `가위바위보를 시작합니다! ${betAmount}원이 베팅됩니다. 선택하세요:`,
            components: [row]
        });

        const filter = (interaction) => interaction.user.id === userId;
        const collector = sentMessage.createMessageComponentCollector({ filter, time: 15000 });

        collector.on('collect', (interaction) => {
            const playerChoice = interaction.customId;
            let result;

            if (playerChoice === botChoice) {
                // 무승부
                stats.money -= betAmount;
                result = `무승부! ${betAmount}원을 잃었습니다.`;
            } else if (
                (playerChoice === 'rock' && botChoice === 'scissors') ||
                (playerChoice === 'scissors' && botChoice === 'paper') ||
                (playerChoice === 'paper' && botChoice === 'rock')
            ) {
                // 승리
                const reward = betAmount * 20;
                stats.money += reward;
                result = `승리! ${reward}원을 얻었습니다.`;
            } else {
                // 패배
                const loss = betAmount * 5;
                stats.money -= loss;
                result = `패배! ${loss}원을 잃었습니다.`;
            }

            if (stats.money < 0) {
                stats.money = 0;
            }

            saveUserData(userData);

            interaction.update({
                content: `가위바위보 결과:\n- 당신의 선택: ${playerChoice === 'rock' ? '🪨 바위' : playerChoice === 'scissors' ? '✂️ 가위' : '📜 보'}\n- 봇의 선택: ${botChoice === 'rock' ? '🪨 바위' : botChoice === 'scissors' ? '✂️ 가위' : '📜 보'}\n- 결과: ${result}\n- 현재 돈: ${stats.money}`,
                components: []
            });

            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                sentMessage.edit({
                    content: '시간 초과로 인해 가위바위보가 종료되었습니다.',
                    components: []
                });
            }
        });
    } else if (message.content === '!주사위' || message.content === '!ㅈㅅㅇ') {
        const stats = userData[userId];
        const now = Date.now();
        if (diceCooldowns.has(userId)) {
            const lastUsed = diceCooldowns.get(userId);
            const remainingTime = 5000 - (now - lastUsed);
            if (remainingTime > 0) {
                await message.reply(`주사위 명령어는 ${Math.ceil(remainingTime / 1000)}초 후에 다시 사용할 수 있습니다.`);
                return;
            }
        }

        diceCooldowns.set(userId, now);

        if (stats.money <= 0) {
            stats.money = 0;
            await message.reply('현재 돈이 부족합니다! !일을 통해 돈을 벌어보세요.');
        } else {
            const randomDice = Math.floor(Math.random() * 6) + 1; // 1부터 6까지의 정수
            let changeAmount = randomDice * 1000;
            let plusmin;

            if (Math.random() < 0.1) {
                plusmin = '-';
                stats.money -= randomDice * 50000;
                changeAmount = randomDice * 50000;
            } else {
                plusmin = '+';
                stats.money += randomDice * 25000;
                changeAmount = randomDice * 25000;
            }

            // 돈이 0원보다 작으면 0원으로 고정
            if (stats.money <= 0) {
                stats.money = 0;
            }

            // 데이터 저장
            saveUserData(userData);

            await message.reply(
                `주사위 결과:\n- 플러스 마이너스: ${plusmin}\n- 증감될 돈: ${changeAmount}\n- 내 돈: ${stats.money}`
            );
        }
    } else if (message.content === '!일'||message.content === '!ㅇ') {
        const stats = userData[userId];
        const level = Math.floor(Math.random() * 3) + 1; // 1부터 3단계
        let problem;
        let answer;

        if (level === 1) {
            const a = Math.floor(Math.random() * 10) + 1;
            const b = Math.floor(Math.random() * 10) + 1;
            problem = `${a} + ${b}`;
            answer = a + b;
        } else if (level === 2) {
            const a = Math.floor(Math.random() * 20) + 1;
            const b = Math.floor(Math.random() * 20) + 1;
            problem = `${a} * ${b}`;
            answer = a * b;
        } else if (level === 3) {
            const a = Math.floor(Math.random() * 50) + 1;
            const b = Math.floor(Math.random() * 10) + 1;
            problem = `${a} / ${b} (정수 몫)`;
            answer = Math.floor(a / b);
        }

        currentProblem[userId] = { problem, answer, level };

        await message.reply(`문제 (레벨 ${level}): ${problem}`);
    } else if (currentProblem[userId] && !isNaN(parseInt(message.content))) {
        const stats = userData[userId];
        const userAnswer = parseInt(message.content);
        const { problem, answer, level } = currentProblem[userId];

        if (userAnswer === answer) {
            const reward = level * 5000;
            stats.money += reward;
            saveUserData(userData);
            delete currentProblem[userId];

            await message.reply(
                `정답입니다!\n문제: ${problem}\n보상: ${reward}\n현재 돈: ${stats.money}`
            );
        } else {
            await message.reply(`오답입니다. 다시 시도해 보세요! 문제: ${problem}`);
        }
    }
});

// 로그인
client.login(TOKEN);
