import { exec } from 'child_process';

const TOKEN = "7410749332:AAFlRPgXM_cyNWkODajyFtRSZMFFuq2MLUk";
const CHAT_ID = "-1002338986078"; // Thay bằng ID nhóm của bạn
const MESSAGE = "Test message from Node.js 🚀";

// Tạo lệnh curl
const curlCommand = `curl -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
     -H "Content-Type: application/json" \
     -d '{"chat_id": "${CHAT_ID}", "text": "${MESSAGE}"}'`;

// Sử dụng exec để chạy lệnh curl
exec(curlCommand);
