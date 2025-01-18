export const columnsT = [
  {
    name: "Áp lực nước",
    selector: (row) => row.Pressure, 
    width: "20%"
  },
  {
    name: "Phần trăm pin",
    selector: (row) => row.battery,
    width: "20%"
  },
  {
    name: "Nhiệt độ",
    selector: (row) => row.temperature,
    width: "20%"
  },
  {
    name: "Thời gian lấy mẫu",
    selector: (row) => new Date(row.createAt).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false // Buộc không dùng định dạng 12 giờ
    })
  },
];



