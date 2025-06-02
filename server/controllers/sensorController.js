import Sensor from "../models/Sensor.js"
import InfoSen from "../models/Info.js";
import Group from "../models/Group.js";
import Alarm from "../models/AlarmFlow.js"
import ExcelJS from 'exceljs';
import { client } from "../mqtt/mqtt.js";
import cron from 'node-cron'
import { differenceInCalendarDays } from 'date-fns'

const scheduledJobs = {};
const userGlobal = [0];

// cron.schedule('1 0 * * *', () => {

// });

// function runYourFunction() {
//   // Code của bạn ở đây
//   console.log('Đang thực hiện công việc...');
// }

function timeToCronExpr(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

const fetchTimeAlarm = async (user, id) => {
  const data = await Alarm.find({ user: user, id: id });
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let closest = null;
  let maxMinutes = -1;
  data.forEach((item) => {
    const itemMinutes = timeToMinutes(item.time);
    if (itemMinutes <= nowMinutes && itemMinutes > maxMinutes) {
      maxMinutes = itemMinutes;
      closest = item;
    }
  })
  if (closest) {
    publishMessage("high_threshold", closest.flow * 1000, closest.id)
  }
}

const publishMessage = (key, message, sen_id) => {
  client.publish(
    'watter/setInterval',
    JSON.stringify({ [key]: message, sen_name: sen_id }),
    (error) => {
      if (error) {
        return false
      } else {
        return true
      }
    }
  )
}

function addDateElement(dataArray, sensor, index, type) {
  if (dataArray[index]) {
    dataArray[index] = (dataArray[index] + sensor[type]) / 2
  }
  else {
    dataArray[index] = sensor[type]
  }
}

function convertTime(timeConvert, watch) {
  return (timeConvert.getHours() * 60 + timeConvert.getMinutes()) * 60 / watch
}


function getDatesInRange(startDate, endDate) {
  const dateArray = [];
  let currentDate = new Date(startDate);

  while (differenceInCalendarDays(endDate, currentDate)) {
    dateArray.push(new Date(currentDate)); // YYYY-MM-DD
    currentDate.setDate(currentDate.getDate() + 1);
  }
  dateArray.push(endDate);
  return dateArray;
}

function getLength(lengModal, listDate) {
  const lengDate = listDate.length;
  const minute_s = listDate[0].getMinutes();
  const minute_e = listDate[lengDate - 1].getMinutes();
  if (lengDate !== 1) {
    return lengModal * lengDate - lengModal * 2 + (24 - listDate[0].getHours() + listDate[lengDate - 1].getHours()) * 12 + Math.floor((minute_e - minute_s) / 5)
  }
  else {
    return (listDate[lengDate - 1].getHours() - listDate[0].getHours()) * 12 + Math.floor((minute_e - minute_s) / 5)
  }
}

// const formatDate = (dateString) => {
//   const date = new Date(dateString);
//   const datePart = date.toLocaleDateString("vi-VN"); // Định dạng dd/mm/yyyy
//   const timePart = date.toLocaleTimeString("vi-VN", { hour12: false, hour: "2-digit", minute: "2-digit" }); // HH:MM

//   return `${datePart} ${timePart}`; // Kết quả dạng "dd/mm/yyyy HH:MM"
// };
function getRowIndexFromTime(timeStr) {
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const slot = hour * 4 + Math.floor(minute / 15);
  return 3 + slot; // bắt đầu từ dòng 3
}

const exportFakeDataToExcel = async (sensorData, res, adj) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // === 1. Viết phần Tổng Hợp (All Stats) ===
    const summarySheet = workbook.addWorksheet("Summary");
    const worksheet = workbook.addWorksheet("Sensors");
    const stats = sensorData[0].stats

    // === 2. Viết phần Từng Ngày (EndOfDay Summary) ===
    worksheet.getRow(1).getCell(1).value = 'Thời gian';
    worksheet.getRow(1).getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 1, 2, 1); // merge ô thời gian (A1:A2)
    const endOfDaySum = sensorData[0].endOfDaySum
    summarySheet.columns = [
      { header: "Ngày", key: "day", width: 12 },
      { header: "Sản lượng", key: "production", width: 12 },
      { header: "Áp suất avg", key: "avgPressure", width: 12 },
      { header: "Áp suất min", key: "minPressure", width: 12 },
      { header: "Thời gian min", key: "minPressureTime", width: 15 },
      { header: "Áp suất max", key: "maxPressure", width: 12 },
      { header: "Thời gian max", key: "maxPressureTime", width: 15 },
      { header: "Lưu lượng avg", key: "avgFlow", width: 12 },
      { header: "Lưu lượng min", key: "minFlow", width: 12 },
      { header: "Thời gian min", key: "minFlowTime", width: 15 },
      { header: "Lưu lượng max", key: "maxFlow", width: 12 },
      { header: "Thời gian max", key: "maxFlowTime", width: 15 },
      { header: "Tổng cuối ngày", key: "totalSum", width: 12 },
    ];
    for (let i = 0; i < 96; i++) {
      const hour = Math.floor(i / 4);
      const minute = (i % 4) * 15;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      worksheet.getRow(3 + i).getCell(1).value = timeStr;
    }
    endOfDaySum.forEach((daySum, idx) => {
      summarySheet.addRow({
        day: daySum._id?.day ?? "",
        production: daySum.lastSum && daySum.firstSum ? (daySum.lastSum - daySum.firstSum).toFixed(1) : "",
        avgPressure: daySum.avgPressure?.toFixed(1) ?? "",
        minPressure: daySum.minPressure?.pressure?.toFixed(1) ?? "",
        minPressureTime: daySum.minPressure?.createAt ?? "",
        maxPressure: daySum.maxPressure?.pressure?.toFixed(1) ?? "",
        maxPressureTime: daySum.maxPressure?.createAt ?? "",
        avgFlow: daySum.avgFlow?.toFixed(2) ?? "",
        minFlow: daySum.minFlow?.flow?.toFixed(2) ?? "",
        minFlowTime: daySum.minFlow?.createAt ?? "",
        maxFlow: daySum.maxFlow?.flow?.toFixed(2) ?? "",
        maxFlowTime: daySum.maxFlow?.createAt ?? "",
        totalSum: daySum.lastSum?.toFixed(1) ?? "",
      });
      const startCol = 2 + idx * 3; // mỗi ngày chiếm 3 cột
      const endCol = startCol + 2;

      // Merge 3 ô thành 1 cho ngày
      worksheet.mergeCells(1, startCol, 1, endCol);
      worksheet.getRow(1).getCell(startCol).value = daySum._id?.day ?? "";
      worksheet.getRow(1).getCell(startCol).alignment = { horizontal: 'center' };

      // Ghi tên cột con
      worksheet.getRow(2).getCell(startCol).value = 'Áp suất';
      worksheet.getRow(2).getCell(startCol + 1).value = 'Lưu lượng';
      worksheet.getRow(2).getCell(startCol + 2).value = 'Sản lượng';
      daySum.data?.forEach(entry => {
        if (Math.floor(entry.createAt / 60000) % 15) {
          return; // chỉ lấy mỗi 15 phút 1 lần
        }
        const date = new Date(entry.createAt);
        const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // HH:mm
        const rowIndex = getRowIndexFromTime(timeStr);
        const row = worksheet.getRow(rowIndex);

        row.getCell(startCol).value = entry.Pressure;
        row.getCell(startCol + 1).value = entry.flow;
        row.getCell(startCol + 2).value = (entry.sum - daySum.firstSum).toFixed(1);
      });
    });
    summarySheet.addRow([]);
    summarySheet.addRow(["TỔNG HỢP TOÀN BỘ"]);
    summarySheet.addRow(["Áp suất avg", stats.avgPressure?.toFixed(1) ?? ""]);
    summarySheet.addRow(["Áp suất min", stats.minPressure?.pressure?.toFixed(1) ?? "", "Lúc", stats.minPressure?.createAt ?? ""]);
    summarySheet.addRow(["Áp suất max", stats.maxPressure?.pressure?.toFixed(1) ?? "", "Lúc", stats.maxPressure?.createAt ?? ""]);
    summarySheet.addRow(["Lưu lượng avg", stats.avgFlow?.toFixed(2) ?? ""]);
    summarySheet.addRow(["Lưu lượng min", stats.minFlow?.flow?.toFixed(2) ?? "", "Lúc", stats.minFlow?.createAt ?? ""]);
    summarySheet.addRow(["Lưu lượng max", stats.maxFlow?.flow?.toFixed(2) ?? "", "Lúc", stats.maxFlow?.createAt ?? ""]);

    // === 3. Viết phần Data Chi Tiết ===
    // worksheet.addRow(["DỮ LIỆU CHI TIẾT"]);
    // worksheet.columns = [
    //   { header: "Thời gian", key: "createAt", width: 30 },
    //   { header: "Áp suất", key: "Pressure", width: 15 },
    //   { header: "Lưu lượng", key: "flow", width: 15 },
    //   { header: "Số tổng", key: "sum", width: 15 },
    // ];
    // sensorData[0]?.data?.forEach(sensor => {
    //   if (Math.floor(sensor.createAt / 60000) % 15) {
    //     return; // chỉ lấy mỗi 15 phút 1 lần
    //   }
    //   worksheet.addRow({
    //     createAt: formatDate(sensor.createAt),
    //     Pressure: (sensor.Pressure + adj)?.toFixed(1),
    //     flow: sensor.flow?.toFixed(2),
    //     sum: sensor.sum?.toFixed(1)
    //   });
    // });

    // ✅ Ghi ra buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(excelBuffer);

    // ✅ Đặt header chính xác
    res.setHeader("Content-Disposition", 'attachment; filename="export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer); // ⚡ Đúng cách truyền file binary
  } catch (error) {
    console.error("❌ Lỗi server khi xuất Excel:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};


export const exportSensors = async (req, res) => {
  try {
    const { sen_name, adj, date, user } = req.body;
    const startOfToday = new Date(date[0]);
    const endOfToday = new Date(date[1]);
    startOfToday.setUTCSeconds(0, 0);
    endOfToday.setUTCSeconds(0, 999);
    const sensorData = await Sensor.aggregate([
      {
        $match: {
          index: sen_name,
          user: user,
          createAt: { $gte: startOfToday, $lte: endOfToday },
        }
      },
      { $sort: { createAt: 1 } },
      {
        $facet: {
          data: [
            { $project: { _id: 0, Pressure: 1, flow: 1, createAt: 1, sum: 1 } }
          ],
          stats: [
            {
              $group: {
                _id: null,
                firstSum: { $first: "$sum" },
                lastSum: { $last: "$sum" },
                avgPressure: { $avg: "$Pressure" },
                minPressure: {
                  $min: {
                    pressure: "$Pressure",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                maxPressure: {
                  $max: {
                    pressure: "$Pressure",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                avgFlow: { $avg: "$flow" },
                minFlow: {
                  $min: {
                    flow: "$flow",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                maxFlow: {
                  $max: {
                    flow: "$flow",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
              }
            }
          ],
          endOfDaySum: [
            {
              $group: {
                _id: {
                  day: { $dateToString: { format: "%Y-%m-%d", date: "$createAt", timezone: "+07:00" } }
                },
                data: {
                  $push: {
                    createAt: "$createAt",
                    Pressure: "$Pressure",
                    flow: "$flow",
                    sum: "$sum"
                  }
                },
                firstSum: { $first: "$sum" }, // sum đầu tiên trong ngày
                lastSum: { $last: "$sum" },    // sum cuối cùng trong ngày
                avgPressure: { $avg: "$Pressure" },
                minPressure: {
                  $min: {
                    pressure: "$Pressure",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                maxPressure: {
                  $max: {
                    pressure: "$Pressure",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                avgFlow: { $avg: "$flow" },
                minFlow: {
                  $min: {
                    flow: "$flow",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
                maxFlow: {
                  $max: {
                    flow: "$flow",
                    createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                  }
                },
              }
            },
            { $sort: { "_id.day": 1 } }
          ]
        }
      },
      {
        $project: {
          data: 1,
          stats: { $arrayElemAt: ["$stats", 0] },
          endOfDaySum: 1
        }
      }
    ]);
    return exportFakeDataToExcel(sensorData, res, adj);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: "Add Sensor server error." });
    }
  }
};

export const upInterval = async (req, res) => {
  const profs = req.body;
  try {
    if (profs.Coor != null) {
      const updateCoor = await InfoSen.findOneAndUpdate({ id: profs.Coor, user: profs.user },
        {
          $set: {
            lat: parseFloat(profs.lat),
            lng: parseFloat(profs.lng)
          }
        },
        { new: true }
      )
      return res.status(200).json({ success: true })
    }
    if (profs.sum != null) {
      if (publishMessage('sum_content', Number(profs.sum).toFixed(1) * 1000, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      return res.status(200).json({ success: true })
    }
    if (profs.unit != null) {
      if (publishMessage('content_unit', Number(profs.unit), profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      return res.status(200).json({ success: true })
    }
    if (profs.adj != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { adj: profs.adj } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.watch != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { watch: profs.watch } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.wPress != null) {
      const inputPress = profs.wPress < 0 ? 0 : Number(profs.wPress).toFixed(2) * 100;
      if (publishMessage('wPress', inputPress, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { wPress: profs.wPress } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.tracking != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { tracking: profs.tracking } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.temp != null) {
      const inputTemp = profs.temp < 0 ? 100 : Math.floor(Number(profs.temp));
      if (publishMessage('temp', inputTemp, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { temperature: profs.temp } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.sample != null) {
      if (publishMessage('sample', profs.sample, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { sample: profs.sample } }, { new: true })
      return res.status(200).json({ success: true, sample: info.sample })
    }
    if (publishMessage('interval', profs.interval, profs.sen_id)) {
      return res.status(500).json({ success: false, error: "Not publish" })
    }
    const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { interval: profs.interval } }, { new: true })
    return res.status(200).json({ success: true, interval: info.interval })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

export const getSensors = async (req, res) => {
  try {
    const profs = req.body;
    const sensors = []
    const timeTrackingRet = []
    const temperature = []
    const battery = []
    const pram = []
    const pramFlow = []
    if (profs.totalMap) {
      for (let i = 0; i < Number(profs.totalMap); i++) {
        const sensor = await Sensor.findOne({ index: i, user: profs.user }).sort({ $natural: -1 });
        sensors[i] = sensor
      }
      return res.status(200).json({ success: true, sensors })
    }
    if (profs.timeGet) {
      const lengModal = 288
      const startOfToday = new Date(profs.timeGet[0]);
      const endOfToday = new Date(profs.timeGet[1]);
      startOfToday.setUTCSeconds(0, 0);
      endOfToday.setUTCSeconds(0, 999);
      const result = await Sensor.aggregate([
        {
          $match: {
            index: profs.sen_name,
            user: profs.user,
            createAt: { $gte: startOfToday, $lte: endOfToday }
          }
        },
        { $sort: { createAt: 1 } },
        {
          $facet: {
            data: [
              { $project: { _id: 0, Pressure: 1, flow: 1, createAt: 1 } }
            ],
            stats: [
              {
                $group: {
                  _id: null,
                  firstSum: { $first: "$sum" },
                  lastSum: { $last: "$sum" },
                  avgPressure: { $avg: "$Pressure" },
                  minPressure: {
                    $min: {
                      pressure: "$Pressure",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  maxPressure: {
                    $max: {
                      pressure: "$Pressure",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  avgFlow: { $avg: "$flow" },
                  minFlow: {
                    $min: {
                      flow: "$flow",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  maxFlow: {
                    $max: {
                      flow: "$flow",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                }
              }
            ],
            endOfDaySum: [
              {
                $group: {
                  _id: {
                    day: { $dateToString: { format: "%Y-%m-%d", date: "$createAt", timezone: "+07:00" } }
                  },
                  firstSum: { $first: "$sum" }, // sum đầu tiên trong ngày
                  lastSum: { $last: "$sum" },    // sum cuối cùng trong ngày
                  avgPressure: { $avg: "$Pressure" },
                  minPressure: {
                    $min: {
                      pressure: "$Pressure",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  maxPressure: {
                    $max: {
                      pressure: "$Pressure",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  avgFlow: { $avg: "$flow" },
                  minFlow: {
                    $min: {
                      flow: "$flow",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                  maxFlow: {
                    $max: {
                      flow: "$flow",
                      createAt: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createAt", timezone: "+07:00" } }
                    }
                  },
                }
              },
              { $sort: { "_id.day": 1 } }
            ]
          }
        },
        {
          $project: {
            data: 1,
            stats: { $arrayElemAt: ["$stats", 0] },
            endOfDaySum: 1
          }
        }
      ]);
      const listDate = getDatesInRange(startOfToday, endOfToday);
      const lengArray = getLength(lengModal, listDate)
      const sensorH = []
      const flowH = []
      const sensorT = Array(lengArray).fill(null)
      const startDate = startOfToday
      const offSetHour = startOfToday.getHours() * 12
      const offSetMinute = Math.floor(startOfToday.getMinutes() / 5)
      result[0].data.forEach((sensor) => {
        const dateOfSensor = new Date(sensor.createAt)
        const currentDate = dateOfSensor
        const convert = differenceInCalendarDays(currentDate, startDate)
        const convertTimeValue = Math.floor(convertTime(sensor.createAt, 300))
        const index = convert * lengModal + convertTimeValue - offSetHour - offSetMinute;
        addDateElement(sensorH, sensor, index, "Pressure");
        addDateElement(flowH, sensor, index, "flow");
        sensorT[index] = sensor
      })
      return res.status(200).json({ success: true, sensorH, flowH, sum: result[0].endOfDaySum, param: result[0].stats, sensorT })
    }
    const startOfToday = new Date();
    const yesterday = new Date(startOfToday);
    yesterday.setDate(startOfToday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    startOfToday.setHours(0, 0, 0, 0);
    for (let i = 0; i < Number(profs.total); i++) {
      timeTrackingRet[i] = 0;
      const sensorY = await Sensor.find({
        index: profs.info[i].id,
        user: profs.user,
        createAt: { $gte: yesterday, $lt: startOfToday },
      })
        .select('flow Pressure createAt')
        .sort({ createAt: 1 });
      const result = await Sensor.aggregate([
        {
          $match: {
            index: profs.info[i].id,
            user: profs.user,
            createAt: { $gte: startOfToday }
          }
        },
        { $sort: { createAt: 1 } },
        {
          $facet: {
            data: [
              { $project: { _id: 0, Pressure: 1, flow: 1, temperature: 1, battery: 1, createAt: 1 } }
            ],
            stats: [
              {
                $group: {
                  _id: null,
                  firstSum: { $first: "$sum" },
                  lastSum: { $last: "$sum" },
                  battery: { $last: "$battery" },
                  temperature: { $last: "$temperature" },
                  avgPressure: { $avg: "$Pressure" },
                  minPressure: { $min: "$Pressure" },
                  maxPressure: { $max: "$Pressure" },
                  avgFlow: { $avg: "$flow" },
                  minFlow: { $min: "$flow" },
                  maxFlow: { $max: "$flow" },
                }
              }
            ],
          }
        },
        {
          $project: {
            data: 1,
            stats: { $arrayElemAt: ["$stats", 0] },
          }
        }
      ]);
      const sensorT = Array(86400 / profs.info[i].watch).fill(null)
      const sensorYRest = []
      const flowYRest = []
      const dataPressure = []
      const dataFlow = []
      let timeTracking = 0
      let currentStart = 0;

      sensorY.forEach((sensor) => {
        const index = Math.floor(convertTime(sensor.createAt, profs.info[i].watch))
        sensorYRest[index] = sensor.Pressure
        flowYRest[index] = sensor.flow
      })
      result[0].data.forEach((sensor) => {
        const index = Math.floor(convertTime(sensor.createAt, profs.info[i].watch))
        addDateElement(dataPressure, sensor, index, "Pressure")
        addDateElement(dataFlow, sensor, index, "flow")
        if (profs.info) {
          if (sensor.Pressure >= profs.info[i].tracking) {
            const timeAdd = Math.floor((sensor.createAt - currentStart) / 1000)
            if (timeAdd < 1000) {
              timeTracking += timeAdd
            }
          }
        }
        currentStart = sensor.createAt
        sensorT[index] = sensor
      })
      if (result[0].data && result[0].data.length > 0) {
        const sensorY24 = await Sensor.findOne({
          index: profs.info[i].id,
          user: profs.user,
          createAt: { $gte: result[0].data[result[0].data.length - 1].createAt - 86400000 },
        }).select('sum -_id').lean();
        const stats = result[0].stats
        battery[i] = stats.battery
        temperature[i] = stats.temperature
        pram[i] = { max: stats.maxPressure, min: stats.minPressure, avg: stats.avgPressure }
        pramFlow[i] = { max: stats.maxFlow, min: stats.minFlow, total24: stats.lastSum - sensorY24.sum, total: stats.lastSum - stats.firstSum, avg: stats.avgFlow, sum: stats.lastSum };
      }
      sensors[i] = { sensorYRest, flowYRest, dataFlow, sensorT, dataPressure }
      timeTrackingRet[i] = Math.round(timeTracking / 60)
    }
    return res.status(200).json({ success: true, sensors, timeTrackingRet, battery, temperature, pram, pramFlow })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

export const addSensor = async (req, res) => {
  try {
    const { sen_name, description, id } = req.body;

    if (!sen_name || !description) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }
    const newSen = new InfoSen({
      tracking: 1.5,
      interval: 60,
      wPress: 0.8,
      wPressTime: 1.2,
      timeAlarm: 300,
      watch: 60,
      adj: 0,
      id: id,
      name: sen_name,
      lat: 105,
      lng: 21,
      sample: 60,
      description: description,
      temperature: 30,
    })
    await newSen.save()
    return res.status(201).json({ success: true, message: "Sensor added successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Add Sensor server error." });
  }
};


export const viewSensor = async (req, res) => {
  try {
    const { id } = req.body;
    const sensor = await InfoSen.findOne({ id: id });
    return res.status(200).json({ success: true, sensor });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}


export const updateSensor = async (req, res) => {
  try {
    const { sen_name, sen_description, id } = req.body;
    const updateSensor = await InfoSen.findOneAndUpdate(
      { id: id },
      {
        $set: {
          description: sen_description,
          name: sen_name // Thêm name vào đây
        }
      },
      { new: true }
    );
    return res.status(200).json({ success: true, message: "Edit data successfully." })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor edit Failed due to some Reason " })
  }
}

export const getGroup = async (req, res) => {
  try {
    const { user } = req.body;
    const sen_group = []
    const group = []
    const Groups = await Group.find({ user: user });
    const senGroup = await InfoSen.find({ user: user });
    group.push("Không có")
    Groups.forEach((sensor) => {
      group.push(sensor.name)
    })
    senGroup.forEach((sensor) => {
      sen_group.push({ group: sensor.group, name: sensor.name })
    })
    return res.status(200).json({ success: true, group, sen_group });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const getSensorInGroup = async (req, res) => {
  try {
    const { group, user } = req.body
    const senInGroup = await InfoSen.find({ group: group, user: user });
    return res.status(200).json({ success: true, senInGroup });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const getGroupInfo = async (req, res) => {
  try {
    const { user } = req.body
    const data = {}
    const valueSenS = []
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const senGroup = await InfoSen.find({ user: user });
    for (let i = 0; i < senGroup.length; i++) {
      const valueSen = await Sensor.findOne({ index: senGroup[i].id, user: user, createAt: { $gte: startOfToday } }).sort({ createAt: -1 });
      valueSenS[senGroup[i].id] = valueSen
    }
    senGroup.forEach((sensor) => {
      // if (!sensor.group || sensor.group === "") sensor.group = "Khong co"
      if (!data[sensor.group]) data[sensor.group] = []
      data[sensor.group].push(sensor)
    })
    return res.status(200).json({ success: true, data, valueSenS });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const changeGroup = async (req, res) => {
  try {
    const profs = req.body;
    // if (profs.newGroup === "Khong co") {
    //   const updateSensor = await InfoSen.findOneAndUpdate(
    //     { name: profs.name, user: profs.user },
    //     { $unset: { group: "" } }
    //   );
    //   return res.status(200).json({ success: true });
    // }
    const updateSensor = await InfoSen.findOneAndUpdate(
      { name: profs.name, user: profs.user },
      {
        $set: {
          group: profs.newGroup // Thêm name vào đây
        }
      },
      { new: true }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const deleteGroup = async (req, res) => {
  try {
    const profs = req.body;
    const delGroup = await Group.deleteOne({ name: profs.groupToRemove, user: profs.user })
    const deleteGroup = await InfoSen.updateMany({ group: profs.groupToRemove, user: profs.user }, { $set: { group: "Không có" } })
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const addGroup = async (req, res) => {
  try {
    const profs = req.body;
    const newGroup = new Group({
      name: profs.newGroup,
      user: profs.user
    })
    await newGroup.save()
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const addAlarm = async (req, res) => {
  try {
    const profs = req.body;
    scheduledJobs[`${profs.name}-${profs.user}-${profs.id}`] = cron.schedule(timeToCronExpr(profs.time), () => {
      publishMessage("high_threshold", profs.flow * 1000, profs.id)
    });
    const newAlarm = new Alarm({
      name: profs.name,
      user: profs.user,
      id: profs.id,
      time: profs.time,
      flow: profs.flow
    })
    await newAlarm.save()
    fetchTimeAlarm(profs.user, profs.id)
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Alarm add failed due to some reason" });
  }
}

export const getAlarm = async (req, res) => {
  try {
    const { user, sen_name } = req.body
    const data = await Alarm.find({ user: user, id: sen_name });
    data.forEach((alarm) => {
      if (!scheduledJobs[`${alarm.name}-${user}-${sen_name}`]) {
        scheduledJobs[`${alarm.name}-${user}-${sen_name}`] = cron.schedule(timeToCronExpr(alarm.time), () => {
          publishMessage("high_threshold", alarm.flow * 1000, sen_name)
        });
      }
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const deleteAlarm = async (req, res) => {
  try {
    const { user, sen_name, name } = req.body
    scheduledJobs[`${name}-${user}-${sen_name}`].stop();
    delete scheduledJobs[`${name}-${user}-${sen_name}`];
    await Alarm.deleteOne({ user: user, id: sen_name, name: name });
    if (Object.keys(scheduledJobs).length === 0) {
      publishMessage("high_threshold", 300000, sen_name)
    }
    else {
      fetchTimeAlarm(user, sen_name)
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

