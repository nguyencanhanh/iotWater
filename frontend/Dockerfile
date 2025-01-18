# Sử dụng image Node.js chính thức
FROM node:20

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy package.json và package-lock.json vào thư mục làm việc
COPY package*.json ./

# Cài đặt các dependencies của project
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mở cổng mà React app sẽ chạy (mặc định là 3000)
EXPOSE 3000

# Chạy lệnh để bắt đầu ứng dụng React
CMD ["npm", "run", "dev"]
