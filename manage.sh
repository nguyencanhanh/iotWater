#!/bin/bash

# Script quản lý hệ thống IoT Water (Test & Production)
# Tác giả: Antigravity

COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_YELLOW='\033[0;33m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_BLUE}==================================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}    HỆ THỐNG QUẢN LÝ DỊCH VỤ IOT WATER            ${COLOR_RESET}"
echo -e "${COLOR_BLUE}==================================================${COLOR_RESET}"

show_menu() {
    echo -e "\nVui lòng chọn một tùy chọn:"
    echo -e "1) ${COLOR_GREEN}Bật${COLOR_RESET} môi trường Test"
    echo -e "2) ${COLOR_RED}Tắt${COLOR_RESET} môi trường Test"
    echo -e "3) Xem ${COLOR_YELLOW}Trạng thái${COLOR_RESET} môi trường Test"
    echo -e "4) ${COLOR_GREEN}Cập nhật (Deploy) sang bên THẬT${COLOR_RESET}"
    echo -e "5) Thoát"
    echo -n "Lựa chọn của bạn [1-5]: "
}

while true; do
    show_menu
    read choice
    case $choice in
        1)
            echo -e "\n---> Đang bật môi trường Test..."
            sed -i 's/# listen 8443 ssl;/listen 8443 ssl;/g' /etc/nginx/sites-available/iotwater2024.mooo.com
            sed -i 's/# listen 8080;/listen 8080;/g' /etc/nginx/sites-available/iotwater2024.mooo.com
            systemctl reload nginx
            systemctl start iotWater-server-test.service
            echo -e "${COLOR_GREEN}✔ Đã bật Backend và Preview (Nginx) Test!${COLOR_RESET}"
            echo -e "Đường dẫn truy cập: https://khca-s.static.good-dns.net:8443/"
            ;;
        2)
            echo -e "\n---> Đang tắt môi trường Test..."
            sed -i 's/listen 8443 ssl;/# listen 8443 ssl;/g' /etc/nginx/sites-available/iotwater2024.mooo.com
            sed -i 's/listen 8080;/# listen 8080;/g' /etc/nginx/sites-available/iotwater2024.mooo.com
            systemctl reload nginx
            systemctl stop iotWater-server-test.service
            echo -e "${COLOR_RED}✔ Đã tắt Backend và Preview (Nginx) Test!${COLOR_RESET}"
            ;;
        3)
            echo -e "\n---> Kiểm tra trạng thái môi trường Test..."
            status=$(systemctl is-active iotWater-server-test.service || true)
            if [ "$status" = "active" ]; then
                echo -e "Backend Test: ${COLOR_GREEN}ĐANG CHẠY (Active)${COLOR_RESET}"
            else
                echo -e "Backend Test: ${COLOR_RED}ĐANG TẮT (Inactive)${COLOR_RESET}"
            fi
            if ss -tlnp | grep -q "8443"; then
                echo -e "Preview (Nginx) Test: ${COLOR_GREEN}ĐANG MỞ (Port 8443/8080)${COLOR_RESET}"
            else
                echo -e "Preview (Nginx) Test: ${COLOR_RED}ĐANG ĐÓNG (Port 8443/8080)${COLOR_RESET}"
            fi
            ;;
        4)
            echo -e "\n${COLOR_YELLOW}---> BẮT ĐẦU CẬP NHẬT SANG BẢN THẬT <---${COLOR_RESET}"
            
            # 1. Đồng bộ code Backend Test sang Backend Thật
            echo -e "\n[1/3] Đang đồng bộ mã nguồn Backend..."
            rsync -av --exclude="node_modules" --exclude=".env" --exclude="logs" --exclude="package-lock.json" /root/KHCA/iotWater/serverTest/ /root/KHCA/iotWater/server/
            
            # 2. Khởi động lại dịch vụ Backend thật
            echo -e "\n[2/3] Đang khởi động lại Backend chính..."
            systemctl restart iotWater-server.service
            echo -e "${COLOR_GREEN}✔ Backend thật đã hoạt động trở lại!${COLOR_RESET}"
            
            # 3. Build & Deploy Frontend thật
            echo -e "\n[3/3] Đang build và deploy Frontend thật..."
            cd /root/KHCA/iotWater/frontend
            ./deploy.sh
            
            echo -e "\n${COLOR_GREEN}🎉 ĐÃ CẬP NHẬT THÀNH CÔNG SANG BẢN THẬT! 🎉${COLOR_RESET}"
            cd /root/KHCA/iotWater
            ;;
        5)
            echo -e "\nCảm ơn bạn đã sử dụng. Hẹn gặp lại!"
            exit 0
            ;;
        *)
            echo -e "${COLOR_RED}Lựa chọn không hợp lệ, vui lòng nhập số từ 1 đến 5!${COLOR_RESET}"
            ;;
    esac
done
