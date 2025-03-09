import Sensor from "../models/Sensor.js"
import Info from "../models/User.js";
import InfoSen from "../models/Info.js";
import ExcelJS from 'exceljs';
import { client } from "../mqtt/mqtt.js";

const lengModal = 288

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

function convertTime(timeConvert, watch) {
  return (timeConvert.getHours() * 60 + timeConvert.getMinutes()) * 60 / watch
}

function getDatesInRange(startDate, endDate) {
  const dateArray = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dateArray.push(new Date(currentDate)); // YYYY-MM-DD
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dateArray;
}

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString("vi-VN"); // Định dạng dd/mm/yyyy
  const timePart = date.toLocaleTimeString("vi-VN", { hour12: false, hour: "2-digit", minute: "2-digit" }); // HH:MM

  return `${datePart} ${timePart}`; // Kết quả dạng "dd/mm/yyyy HH:MM"
};

const exportFakeDataToExcel = async (sensors, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sensors");

    worksheet.columns = [
      { header: "Thời gian", key: "createAt", width: 30 },
      { header: "Áp suất", key: "Pressure", width: 15 },
      // { header: "Nhiệt độ", key: "temperature", width: 15 },
    ];

    sensors.forEach(sensor => {
      if (Math.floor(sensor.createAt / 60000) % 5) {
        return;
      }
      worksheet.addRow({
        createAt: formatDate(sensor.createAt),
        Pressure: sensor.Pressure,
        // temperature: sensor.temperature,
      });
    });

    // ✅ Ghi dữ liệu vào buffer
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
    const { sen_name, date } = req.body;
    const endOfToday = new Date(date[1]);
    endOfToday.setUTCHours(23, 59, 59, 999);
    const sensorData = await Sensor.find({
      index: sen_name,
      createAt: { $gte: date[0], $lte: endOfToday }
    }).sort({ createAt: 1 });
    return exportFakeDataToExcel(sensorData, res);
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
      const updateCoor = await InfoSen.findOneAndUpdate({ id: profs.Coor },
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
    if(profs.adj != null){
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { adj: profs.adj } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.wPressTime != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { wPressTime: profs.wPressTime } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.timeAlarm != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { timeAlarm: profs.timeAlarm } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.watch != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { watch: profs.watch } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.wPress != null) {
      // if (profs.wPress <= 0) {
      //   const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { wPress: profs.wPress } }, { new: true })
      //   return res.status(200).json({ success: true })
      // }
      if (publishMessage('wPress', Number(profs.wPress).toFixed(2) * 100, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { wPress: profs.wPress } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.tracking != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { tracking: profs.tracking } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.temp != null) {
      // if (profs.temp < 0) {
      //   const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { temperature: profs.temp } }, { new: true })
      //   return res.status(200).json({ success: true })
      // }
      if (publishMessage('temp', Math.floor(Number(profs.temp)), profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { temperature: profs.temp } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.sample != null) {
      if (publishMessage('sample', profs.sample, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { sample: profs.sample } }, { new: true })
      return res.status(200).json({ success: true, sample: info.sample })
    }
    if (publishMessage('interval', profs.interval, profs.sen_id)) {
      return res.status(500).json({ success: false, error: "Not publish" })
    }
    const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { interval: profs.interval } }, { new: true })
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
    const battery = []
    if (profs.totalMap) {
      for (let i = 0; i < Number(profs.totalMap); i++) {
        const sensor = await Sensor.findOne({ index: i }).sort({ $natural: -1 });
        sensors[i] = sensor
      }
      return res.status(200).json({ success: true, sensors })
    }
    if (profs.timeGet) {
      const startOfToday = new Date(profs.timeGet[0]);
      const endOfToday = new Date(profs.timeGet[1]);
      startOfToday.setDate(startOfToday.getDate() - 1);
      endOfToday.setUTCHours(23, 59, 59, 999);
      const sensorData = await Sensor.find({
        index: profs.sen_name,
        createAt: { $gte: startOfToday, $lte: endOfToday }
      }).sort({ createAt: 1 });
      const listDate = getDatesInRange(startOfToday, endOfToday);
      const lengArray = lengModal * listDate.length - lengModal
      const sensorH = Array(lengArray).fill(null)
      const sensorY = Array(lengArray).fill(null)
      const sensorT = Array(lengArray).fill(null)
      const startDate = startOfToday.getDate()
      sensorData.forEach((sensor) => {
        const dateOfSensor = new Date(sensor.createAt)
        const currentDate = dateOfSensor.getDate()
        let index = (currentDate - startDate) * lengModal + Math.floor(convertTime(sensor.createAt, 300))
        if (index < lengArray) {
          if (sensorY[index]) {
            sensorY[index] = (sensorY[index] + sensor.Pressure) / 2
          }
          else {
            sensorY[index] = sensor.Pressure.toFixed(2)
          }
        }
        if (index > lengModal) {
          index = index - lengModal
          if (sensorH[index]) {
            sensorH[index] = (sensorH[index] + sensor.Pressure) / 2
          }
          else {
            sensorH[index] = sensor.Pressure.toFixed(2)
          }
          sensorT[index] = sensor
        }
      })
      return res.status(200).json({ success: true, sensorH, sensorY, sensorT })
    }
    const startOfToday = new Date();
    const yesterday = new Date(startOfToday);
    yesterday.setDate(startOfToday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    startOfToday.setHours(0, 0, 0, 0);
    for (let i = 0; i < Number(profs.total); i++) {
      timeTrackingRet[i] = 0;
      const sensorY = await Sensor.find({
        index: i,
        createAt: { $gte: yesterday, $lte: startOfToday },
      }).sort({ createAt: 1 });
      const sensorN = await Sensor.find({
        index: i,
        createAt: { $gte: startOfToday },
      }).sort({ createAt: 1 });
      const sensorT = Array(86400 / profs.info[i].watch).fill(null)
      const sensorYRest = []
      const dataPressure = []
      let timeTracking = 0
      let currentStart = 0;

      sensorY.forEach((sensor) => {
        const index = Math.floor(convertTime(sensor.createAt, profs.info[i].watch))
        sensorYRest[index] = sensor.Pressure.toFixed(2)
      })
      sensorN.forEach((sensor) => {
        if (profs.info) {
          if (sensor.Pressure >= profs.info[i].tracking) {
            const timeAdd = Math.floor((sensor.createAt - currentStart) / 1000)
            if (timeAdd < 1000) {
              timeTracking += timeAdd
            }
          }
        }
        currentStart = sensor.createAt
        const index = Math.floor(convertTime(sensor.createAt, profs.info[i].watch))
        if (dataPressure[index]) {
          dataPressure[index] = (dataPressure[index] + sensor.Pressure) / 2
        }
        else {
          dataPressure[index] = sensor.Pressure
        }
        sensorT[index] = sensor;
        // dataPressure[index] = sensor.Pressure
      })
      if (sensorN.length !== 0) {
        battery[i] = sensorN[sensorN.length - 1].battery
      }
      timeTrackingRet[i] = Math.round(timeTracking / 60)
      sensors[i] = { sensorYRest, sensorT, dataPressure }
    }
    return res.status(200).json({ success: true, sensors, timeTrackingRet, battery })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

export const addSensor = async (req, res) => {
  try {
    const { sen_name, description } = req.body;

    if (!sen_name || !description) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }
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


export const deleteSensor = async (req, res) => {
  try {
    const { id } = req.params;
    const deleteSen = await Sensor.findById(id); // Directly pass id
    await Sensor.deleteOne()

    if (!deleteSen) {
      return res.status(404).json({ success: false, error: "Sensor not found" });
    }

    return res.status(200).json({ success: true, deleteSen });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor delete failed due to some reason" });
  }
};
