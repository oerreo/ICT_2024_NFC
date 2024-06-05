const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const mysql = require("mysql");
const path = require("path");

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

let lastNfcData = null; // 가장 최근에 읽은 NFC 데이터를 저장할 변수

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
    lastNfcData = nfcData; // 최근 NFC 데이터를 저장
    io.emit("nfc_uid", nfcData); // 클라이언트로 UID 전송
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
        const stuNum = String(results[0].stu_num); // stuNum을 문자열로 변환
        console.log("NFC matched: ", results[0]);
        io.emit("NFC_Match", `출입자: ${userName} (${stuNum.substr(0, 7)})`);
      } else {
        console.log("NFC not allowed");
        io.emit("NFC_Match", "NFC not allowed");
      }
    }
  );
});

// 새로운 유저 데이터 수신 및 데이터베이스 저장
io.on("connection", (socket) => {
  socket.on("add_nfc_user", (userData) => {
    const { userName, stuNum } = userData;
    const uid = lastNfcData;

    if (!uid) {
      socket.emit("database_error", "NFC UID를 읽지 못했습니다.");
      return;
    }

    db.query(
      "INSERT INTO allow_uid (user_name, stu_num, uid) VALUES (?, ?, ?)",
      [userName, stuNum, uid],
      (err, results) => {
        if (err) {
          console.error("Error inserting into database: " + err.message);
          socket.emit("database_error", "등록에 실패하였습니다.");
          return;
        }
        console.log("User added to database:", results);
        socket.emit("database_success", "성공적으로 등록되었습니다.");
      }
    );
  });
});

// form.html 제공
app.get("/form/form.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form", "form.html"));
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
