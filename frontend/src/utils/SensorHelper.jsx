export const columnsT = [
  {
    name: "Áp lực nước",
    selector: (row) => row.Pressure ? row.Pressure.toFixed(1) : "N/A", 
    width: "20%"
  },
  {
    name: "Phần trăm pin",
    selector: (row) => row.battery ? row.battery : "N/A",
    width: "20%"
  },
  {
    name: "Nhiệt độ",
    selector: (row) => row.temperature ? row.temperature : "N/A",
    width: "20%"
  },
  {
    name: "Thời gian lấy mẫu",
    selector: (row) => new Date(row.createAt).toLocaleString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // Buộc không dùng định dạng 12 giờ
    })
  },
];



