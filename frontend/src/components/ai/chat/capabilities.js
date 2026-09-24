// Danh muc nang luc cua tro ly. Dung chung cho thanh ben trai va man hinh chao,
// de them nang luc moi chi phai sua mot cho.

export const CAPABILITY_GROUPS = [
  {
    key: "overview",
    title: "Tổng quan vận hành",
    icon: "gauge",
    tone: "teal",
    description: "Sức khỏe hệ thống, logger mất tín hiệu, sản lượng trong ngày",
    samples: [
      "Tổng quan hệ thống hôm nay",
      "Logger nào đang mất tín hiệu?",
      "Tình hình nhóm Bách Việt thế nào?",
    ],
  },
  {
    key: "incident",
    title: "Sự cố & cảnh báo",
    icon: "alert",
    tone: "rose",
    description: "Điểm sự cố hiện trường và cảnh báo phát sinh theo ngày",
    samples: [
      "Có sự cố nào chưa xử lý không?",
      "Sự cố quanh logger 28429",
      "Cảnh báo hôm nay",
    ],
  },
  {
    key: "report",
    title: "Báo cáo & so sánh",
    icon: "chart",
    tone: "blue",
    description: "Trích xuất số liệu theo khoảng thời gian, so sánh nhiều logger",
    samples: [
      "Xuất dữ liệu logger 28429 7 ngày qua",
      "So sánh áp suất logger 28429 và 28430 tuần này",
      "Báo cáo logger 28429 tháng trước theo ngày",
    ],
  },
  {
    key: "anomaly",
    title: "Phân tích bất thường",
    icon: "alert",
    tone: "rose",
    description: "AI đọc áp lực, lưu lượng cả nhóm để tìm tụt áp, rò rỉ, mất dữ liệu",
    samples: [
      "Phân tích bất thường nhóm Bách Việt 30 ngày qua",
      "Dựa vào lưu lượng, áp lực nhóm Song Mai 1 tháng vừa qua có gì bất thường không?",
    ],
  },
  {
    key: "dma",
    title: "Thất thoát DMA",
    icon: "water",
    tone: "amber",
    description: "Đầu vào, lượng ghi nhận, thất thoát và lưu lượng đêm tối thiểu",
    samples: [
      "Thất thoát DMA tháng này",
      "DMA nào đang thất thoát cao nhất?",
    ],
  },
  {
    key: "catalog",
    title: "Tra cứu thiết bị",
    icon: "list",
    tone: "slate",
    description: "Danh sách logger theo nhóm và thông số mới nhất của từng logger",
    samples: [
      "Liệt kê logger nhóm Bách Việt",
      "Mở dữ liệu logger 28429",
    ],
  },
];

export const WELCOME_TEXT = "Chào bạn, mình là trợ lý vận hành của hệ thống. Mình đọc được dữ liệu logger, sự cố hiện trường, cảnh báo và thất thoát DMA — nhưng không bao giờ ghi hay thay đổi bất cứ thứ gì.";

export const QUICK_PROMPTS = [
  "Tổng quan hệ thống hôm nay",
  "Có sự cố nào chưa xử lý không?",
  "Cảnh báo hôm nay",
  "Thất thoát DMA tháng này",
  "Phân tích bất thường nhóm Bách Việt 30 ngày qua",
];
