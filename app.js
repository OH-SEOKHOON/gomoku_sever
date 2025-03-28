//필요한 모듈 불러오기
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongodb = require('mongodb');		//mongodb연결에 필요한 라이브러리
var MongoClient = mongodb.MongoClient;	//mongodb연결에 필요한 라이브러리

//홈페이지(/)에 대한 라우팅을 정의
var indexRouter = require('./routes/index');

///users 경로에 대한 라우팅을 정의
var usersRouter = require('./routes/users');

//세션을 관리하는 미들웨어로, 사용자의 요청을 추적하고 세션 데이터를 서버에 저장
const session = require('express-session');

//세션 데이터를 파일 시스템에 저장
var fileStore = require('session-file-store')(session);

//express()를 호출하여 Express 애플리케이션 인스턴스를 생성
var app = express();

//세션을 설정하고 관리
app.use(session({
  //세션 데이터를 암호화하는 데 사용되는 비밀 키.
  //환경 변수로 설정되며, 없으면 기본값 'session-login'을 사용
  secret: process.env.SESSION_SECRET || 'session-login',
  
  //세션을 매 요청마다 저장할지 여부를 결정
  resave: false,
  
  //초기화되지 않은 세션도 저장할지 여부를 결정
  saveUninitialized: false,
  
  //세션 데이터를 파일 시스템에 저장하도록 설정
  store: new fileStore({
    //저장위치
    path: './sessions',
    //유효기간
    ttl: 24 * 60 * 60,
    //만료된 세션을 청소하는 기간
    reapInterval: 60 * 60
  }),
  
  //세션 쿠키의 설정을 정의
  cookie: {
  	//클라이언트 측에서 자바스크립트로 쿠키를 접근할 수 없게 함
    httpOnly: true,
    //프로덕션 환경에서만 HTTPS를 사용하도록 설정
    secure: process.env.NODE_ENV === 'production',
    //쿠키의 만료 시간
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// MongoDB 연결
async function connectDB() {

  //MongoDB 데이터베이스의 URL
  var databaseURL = "mongodb://localhost:27017/gomoku";

  try {
    const database = await MongoClient.connect(databaseURL, {
      //MongoDB 드라이버의 최신 옵션을 사용하여 안정적인 연결을 보장
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("DB 연결 완료: " + databaseURL);
    
    //연결 성공시 database 객체를 Express 애플리케이션의 설정에 추가하고
    //애플리케이션 전체에서 사용할 수 있도록 합니다.
    app.set('database', database.db('gomoku'));

    // 연결 종료 처리
    process.on("SIGINT", async () => {
      await database.close();
      console.log("DB 연결 종료");
      process.exit(0);
    });
  } catch (err) {
    console.error("DB 연결 실패: " + err);
    process.exit(1);
  }
}

connectDB().catch(err => {
  console.error("초기 DB 연결 실패: " + err);
  process.exit(1);
});



// 뷰 엔진 설정
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// 미들웨어 설정
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 라우팅 설정
app.use('/', indexRouter);
app.use('/users', usersRouter);

//  404 오류 처리
app.use(function(req, res, next) {
  next(createError(404));
});

// 에러 처리
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

//애플리케이션 모듈화
module.exports = app;