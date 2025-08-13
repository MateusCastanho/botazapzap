// Bot Contador de Cocô para WhatsApp v6
// Criado com a biblioteca whatsapp-web.js

// --- CONFIGURAÇÕES ---
const NOME_DO_GRUPO_ALVO = "Cagoes";
const ADMIN_NUMBER = '554591065603@c.us'; 

// --- INÍCIO DO CÓDIGO ---

const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const schedule = require('node-schedule');

const ARQUIVO_MENSAL_DB = './ranking_mensal.json';
const ARQUIVO_DIARIO_DB = './ranking_diario.json';

// Estrutura de dados inicial
const getInitialMonthlyData = () => ({
    users: {}
});
let rankingMensal = getInitialMonthlyData();
let rankingDiario = {};

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

// Carrega os dados dos arquivos
try {
    if (fs.existsSync(ARQUIVO_MENSAL_DB)) {
        rankingMensal = JSON.parse(fs.readFileSync(ARQUIVO_MENSAL_DB, 'utf8'));
        if (!rankingMensal.users) {
            rankingMensal = getInitialMonthlyData();
        }
    }
    if (fs.existsSync(ARQUIVO_DIARIO_DB)) {
        rankingDiario = JSON.parse(fs.readFileSync(ARQUIVO_DIARIO_DB, 'utf8'));
    }
    console.log('Bancos de dados carregados.');
} catch (err) {
    console.error('Erro ao carregar os bancos de dados:', err);
}

function salvarDados() {
    try {
        fs.writeFileSync(ARQUIVO_MENSAL_DB, JSON.stringify(rankingMensal, null, 2));
        fs.writeFileSync(ARQUIVO_DIARIO_DB, JSON.stringify(rankingDiario, null, 2));
    } catch (err) {
        console.error('Erro ao salvar os dados:', err);
    }
}

function checkNewDay() {
    const today = getTodayDateString();
    if (rankingDiario.date !== today) {
        console.log(`Novo dia detectado! Resetando o ranking diário.`);
        rankingDiario = {
            date: today,
            totalPoopsToday: 0,
            users: {}
        };
        salvarDados();
    }
}

console.log('Iniciando o bot...');
const client = new Client({ authStrategy: new LocalAuth() });

// [MUDANÇA] GERA UM LINK PARA O QR CODE EM VEZ DE DESENHAR
client.on('qr', qr => {
    console.log('--------------------------------------------------');
    console.log('O QR CODE NÃO PODE SER EXIBIDO AQUI.');
    console.log('ABRA O LINK ABAIXO NO SEU NAVEGADOR PARA ESCANEAR:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`);
    console.log('--------------------------------------------------');
});


client.on('ready', () => {
    console.log('==================================================');
    console.log('✅ Cliente conectado e pronto para uso!');
    console.log(`Monitorando o grupo: "${NOME_DO_GRUPO_ALVO}"`);
    console.log(`Administrador: ${ADMIN_NUMBER}`);
    console.log('==================================================');

    schedule.scheduleJob('59 23 * * *', async () => {
        console.log('Executando tarefa agendada: Resumo do dia.');
        checkNewDay();
        
        const totalDoDia = rankingDiario.totalPoopsToday || 0;
        const msgResumo = `🌜 *Resumo do Dia* 🌛\n\nO total de cagadas de hoje foi de *${totalDoDia}*! 💩\n\nPreparem-se para o novo dia!`;

        try {
            const chats = await client.getChats();
            const grupoAlvo = chats.find(chat => chat.isGroup && chat.name === NOME_DO_GRUPO_ALVO);
            if (grupoAlvo) await grupoAlvo.sendMessage(msgResumo);
        } catch (error) {
            console.error('Erro ao enviar a mensagem de resumo:', error);
        }
    });
    console.log('Tarefa de resumo diário agendada para 23:59.');
});

client.on('message', async message => {
    try {
        const chat = await message.getChat();
        if (!chat.isGroup || chat.name !== NOME_DO_GRUPO_ALVO) return;

        checkNewDay();

        const sender = await message.getContact();
        const senderName = sender.pushname || sender.name || 'Alguém';
        const senderId = sender.id._serialized;

        if (message.body.includes('💩')) {
            if (!rankingMensal.users[senderId]) {
                rankingMensal.users[senderId] = { name: senderName, totalCount: 0 };
            }
            if (!rankingDiario.users[senderId]) {
                rankingDiario.users[senderId] = { count: 0 };
            }

            rankingMensal.users[senderId].name = senderName;
            rankingMensal.users[senderId].totalCount++;
            rankingDiario.users[senderId].count++;
            rankingDiario.totalPoopsToday++;

            const contagemDiariaUsuario = rankingDiario.users[senderId].count;
            
            const resposta = `💩 de ${senderName} registrada!\nTotal no dia: ${contagemDiariaUsuario}`;
            chat.sendMessage(resposta);
            
            if (contagemDiariaUsuario === 10) {
                const cagaoMasterMsg = `👑👑 *CAGÃO MASTER* 👑👑\n${senderName} ATINGIU A MARCA DE 10 CAGADAS HOJE! UMA LENDA VIVA!`;
                for (let i = 0; i < 10; i++) {
                    await chat.sendMessage(cagaoMasterMsg);
                }
            }

            salvarDados();
        }

        if (message.body.trim().toLowerCase() === '!ranking') {
            const rankingArray = Object.values(rankingMensal.users);
            if (rankingArray.length === 0) {
                return chat.sendMessage('Ninguém cagou ainda este mês! 🚽');
            }
            rankingArray.sort((a, b) => b.totalCount - a.totalCount);

            let rankingMsg = `🏆 *Ranking de Cagadas do Mês* 🏆\n\n`;
            rankingArray.forEach((user, index) => {
                let medalha = ['🥇', '🥈', '🥉'][index] || ` ${index + 1}.`;
                rankingMsg += `${medalha} *${user.name}* - ${user.totalCount} cagadas\n`;
            });
            chat.sendMessage(rankingMsg);
        }

        if (message.body.trim().toLowerCase() === '!reset') {
            if (senderId === ADMIN_NUMBER) {
                rankingMensal = getInitialMonthlyData();
                
                console.log('Resetando ranking diário como parte do !reset.');
                rankingDiario = {
                    date: getTodayDateString(),
                    totalPoopsToday: 0,
                    users: {}
                };

                salvarDados();
                chat.sendMessage('🚨 *RANKING ZERADO!* 🚨\n\nA contagem para o novo mês começou agora!');
            } else {
                 console.log(`Tentativa de reset sem permissão por ${senderId}.`);
            }
        }
    } catch (error) {
        console.error('Ocorreu um erro ao processar a mensagem:', error);
    }
});

client.initialize();
