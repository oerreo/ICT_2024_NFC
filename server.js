const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const mysql = require("mysql");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 정적 파일 제공 설정
app.use(express.static("public"));

// MySQL 데이터베이스 설정
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "!MasterOreo190381!",
  database: "nfc_db",
});

// 데이터베이스 연결
db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database: " + err.stack);
    return;
  }
  console.log("Connected to database.");
});

// 시리얼 포트 설정
const portSettings = {
  path: "/dev/ttyUSB0",
  baudRate: 115200,
};
const port = new SerialPort(portSettings);
const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

// 시리얼 데이터 수신
parser.on("data", (data) => {
  console.log(`Received data: ${data}`);
  let nfcData = data.trim();
  console.log(`Trimmed nfc data: ${nfcData}`); // Trimmed 데이터 로그

  // 공백 및 제어 문자 제거를 위해 정규 표현식 사용
  // UID 값만 추출
  const match = nfcData.match(
    /0x[0-9A-Fa-f]+\s0x[0-9A-Fa-f]+\s0x[0-9A-Fa-f]+\s0x[0-9A-Fa-f]+/
  );
  if (match) {
    nfcData = match[0].replace(/\s+/g, "");
    console.log(`Extracted nfc data: ${nfcData}`); // Extracted 데이터 로그
  } else {
    console.log("No valid UID found in the data");
    return;
  }
  console.log(`Cleaned nfc data: ${nfcData}`); // Cleaned 데이터 로그

  // 문자열 길이 로그
  console.log(
    `Original length: ${data.length}, Trimmed length: ${nfcData.length}`
  );

  // 데이터베이스 쿼리
  db.query(
    "SELECT * FROM allow_uid WHERE uid = ?",
    [nfcData],
    (err, results) => {
      if (err) {
        console.error(err.message);
        return;
      }
      if (results.length > 0) {
        const userName = results[0].user_name;
        const stuNum = results[0].stu_num;
        stuNum.replace();
        console.log("NFC matched: ", results[0]);
        //찍혀있는 uid가 로그에 남으니까 추적가능.
        io.emit("NFC_Match", `출입자: ${userName} (${stuNum.substr(0, 7)})`);
        //io.emit("NFC_Match", `NFC matched: ${results[0].uid}`);
      } else {
        console.log("NFC not allowed");
        io.emit("NFC_Match", "NFC not allowed");
      }
    }
  );
});

// 시리얼 포트 에러 처리
port.on("error", function (err) {
  console.log("Error: ", err.message);
});

// 서버 실행
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
