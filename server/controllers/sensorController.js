import Sensor from "../models/Sensor.js"
import Info from "../models/User.js";
import InfoSen from "../models/Info.js";
import ExcelJS from 'exceljs';
import { client } from "../mqtt/mqtt.js";

const publishMessage = (key, message) => {
  client.publish(
    'watter/setInterval',
    JSON.stringify({ [key]: message }),
    (error) => {
      if (error) {
        return false
      } else {
        return true
      }
    }
  )
}

function convertTime(timeConvert) {
  return timeConvert.getHours() * 60 + timeConvert.getMinutes()
}

const exportFakeDataToExcel = async (sensors, info, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sensors');

    worksheet.columns = [
      { header: 'Thời gian', key: 'createAt', width: 30 },
      { header: 'Tên cảm biến', key: 'sen_name', width: 30 },
      { header: 'Áp suất', key: 'Pressure', width: 15 },
      { header: 'Nhiệt độ', key: 'temperature', width: 15 },
    ];

    sensors.forEach(sensor => {
      worksheet.addRow({
        sen_name: info.sen_id[sensor.index],
        Pressure: sensor.Pressure,
        createAt: sensor.createAt.toISOString(),
      });
    });

    // Ghi workbook vào buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Kiểm tra nếu response đã gửi
    if (res.headersSent) return;

    // Thiết lập header để tải file
    res.setHeader("Content-Disposition", "attachment; filename=export.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    // Gửi buffer về client
    return res.status(200).json({ success: true, excelBuffer });

  } catch (error) {
    console.error('Error exporting fake data to Excel:', error);

    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: "Add Sensor server error." });
    }
  }
};

export const exportSensors = async (req, res) => {
  try {
    const { type, timeGet } = req.body;
    if (timeGet) {
      const allData = await Sensor.find({ createAt: { $gte: timeGet[0].valueOf(), $lte: timeGet[1].valueOf() } });
      const info = await Info.findOne({});
      return exportFakeDataToExcel(allData, info, res);
    }
    const pastTime = Date.now() - Number(type) * 60 * 1000;
    const allData = await Sensor.find({ createAt: { $gte: pastTime } });

    const info = await Info.findOne({});

    // Chỉ gọi exportFakeDataToExcel, không gửi JSON response sau đó
    return exportFakeDataToExcel(allData, info, res);

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
      const updateCoor = await Info.findOneAndUpdate({},
        {
          $set: {
            [`sen_id.${profs.Coor}.lat`]: parseFloat(profs.lat),
            [`sen_id.${profs.Coor}.lng`]: parseFloat(profs.lng)
          }
        },
        { new: true }
      )
      return res.status(200).json({ success: true })
    }
    if (profs.tracking != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { tracking: profs.tracking } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.trackingB != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { trackingB: profs.trackingB } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.temp != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { temperature: profs.temp } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.sample != null) {
      if (publishMessage('sample', profs.sample)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id }, { $set: { sample: profs.sample } }, { new: true })
      return res.status(200).json({ success: true, sample: info.sample })
    }
    if (publishMessage('interval', profs.interval)) {
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
    const timeTrackingRetB = []
    const battery = []
    if (profs.totalMap) {
      for (let i = 0; i < Number(profs.totalMap); i++) {
        const sensor = await Sensor.findOne({ index: i }).sort({ $natural: -1 });
        sensors[i] = sensor
      }
      return res.status(200).json({ success: true, sensors })
    }
    if (profs.timeGet) {
      const yesterday = new Date(profs.timeGet[0]);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      for (let i = 0; i < Number(profs.total); i++) {
        timeTrackingRet[i] = 0
        timeTrackingRetB[i] = 0;
        const sensor = await Sensor.find({
          index: i,
          createAt: { $gte: profs.timeGet[0].valueOf(), $lte: profs.timeGet[1].valueOf() }
        })
        const sensorY = await Sensor.find({
          index: i,
          createAt: { $gte: yesterday, $lte: profs.timeGet[0].valueOf() },
        });
        const sensorT = Array(1440).fill(null)
        const dataPressure = []
        const sensorYRest = []
        let timeTracking = 0
        let currentStart = null;
        let timeTrackingB = 0
        let currentStartB = null;
        sensorY.forEach((sensor) => {
          const index = Math.floor(convertTime(sensor.createAt))
          sensorYRest[index] = sensor.Pressure
        })
        sensor.forEach((sensor) => {
          if (profs.info !== null) {
            if (sensor.Pressure >= profs.info[i].tracking) {
              if (!currentStart) {
                currentStart = sensor.createAt
              }
            }
            else {
              if (currentStart) {
                const timeAdd = Math.floor((sensor.createAt - currentStart) / 1000)
                if (timeAdd < 2000) {
                  timeTracking += timeAdd
                }
                currentStart = null;
              }
            }
            if (sensor.Pressure <= profs.info[i].trackingB) {
              if (!currentStartB) {
                currentStartB = sensor.createAt
              }
            }
            else {
              if (currentStartB) {
                const timeAdd = Math.floor((sensor.createAt - currentStartB) / 1000)
                if (timeAdd < 2000) {
                  timeTrackingB += timeAdd
                }
                currentStartB = null;
              }
            }
          }
          const index = Math.floor(convertTime(sensor.createAt))
          timeTrackingRet[i] = Math.round(timeTracking / 60)
          timeTrackingRetB[i] = Math.round(timeTrackingB / 60)
          dataPressure[index] = sensor.Pressure
          sensorT[index] = sensor
        })
        sensors[i] = { sensorT, sensorYRest, dataPressure }
      }
      return res.status(200).json({ success: true, sensors, timeTrackingRet, timeTrackingRetB })
    }
    const startOfToday = new Date();
    const yesterday = new Date(startOfToday);
    yesterday.setDate(startOfToday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    startOfToday.setHours(0, 0, 0, 0);
    for (let i = 0; i < Number(profs.total); i++) {
      timeTrackingRet[i] = 0;
      timeTrackingRetB[i] = 0;
      const sensorY = await Sensor.find({
        index: i,
        createAt: { $gte: yesterday, $lte: startOfToday },
      });
      const sensorN = await Sensor.find({
        index: i,
        createAt: { $gte: startOfToday },
      }).sort({ createAt: 1 });
      const sensorT = Array(1440).fill(null)
      const sensorYRest = []
      const dataPressure = []
      let timeTracking = 0
      let currentStart = 0;
      let timeTrackingB = 0

      sensorY.forEach((sensor) => {
        const index = Math.floor(convertTime(sensor.createAt))
        sensorYRest[index] = sensor.Pressure
      })
      sensorN.forEach((sensor) => {
        if (profs.info) {
          if (sensor.Pressure >= profs.info[i].tracking) {
            const timeAdd = Math.floor((sensor.createAt - currentStart) / 1000)
            if (timeAdd < 1000) {
              timeTracking += timeAdd
            }
          }
          if (sensor.Pressure <= profs.info[i].trackingB) {
            const timeAdd = Math.floor((sensor.createAt - currentStart) / 1000)
            if (timeAdd < 1000) {
              timeTrackingB += timeAdd
            }
          }
        }
        currentStart = sensor.createAt
        const index = Math.floor(convertTime(sensor.createAt))
        sensorT[index] = sensor
        dataPressure[index] = sensor.Pressure
      })
      if (sensorN.length !== 0) {
        battery[i] = sensorN[sensorN.length - 1].battery
      }
      timeTrackingRet[i] = Math.round(timeTracking / 60)
      timeTrackingRetB[i] = Math.round(timeTrackingB / 60)
      sensors[i] = { sensorYRest, sensorT, dataPressure }
    }
    return res.status(200).json({ success: true, sensors, timeTrackingRet, timeTrackingRetB, battery })
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
    const infoName = await Info.findOne({});
    const info = await Info.findOneAndUpdate({},
      {
        $push: {
          sen_id: { name: sen_name, id: infoName.total }
        },
        $inc: { total: 1 },
      },
      { new: true }
    );
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
