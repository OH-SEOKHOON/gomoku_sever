//필요한 라이브러리 임포트
var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt'); //비밀번호를 안전하게 해싱하는 데 사용되는 라이브러리
var saltrounds = 10; //bcrypt 해싱에서 사용할 salt의 복잡도를 결정하는 값

const { ObjectId } = require('mongodb');
//MongoDB에서 _id는 ObjectId 타입으로 저장되기에
//ObjectId를 가져와서 userId 값을 변환할 때 사용.

//로그인 응답 결과에 대한 상태 코드를 정의하는 객체
var ResponseType = {
  //잘못된 사용자 이름일경우 결과값이 0이됨
  INVALID_USERNAME: 0,
  //비밀번호가 틀린 경우 결과값이 1이됨
  INVALID_PASSWORD: 1,
  //문제없이 로그인 됬을경우 결과값이 2가됨
  SUCCESS: 2
}

//기본 GET 요청 처리
//users 경로로 GET 요청이 들어오면, respond with a resource라는 메시지를 응답
//아까 postman에서 테스트 했던게 이 기능
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});


// 회원가입
router.post('/signup', async function(req, res, next) {
  try {
  	//username, password, nickname을 요청 본문에서 받아옴
    var username = req.body.username;
    var password = req.body.password;
    var nickname = req.body.nickname;

    // 입력값 검증
    if (!username || !password || !nickname) {
      return res.status(400).send("모든 필드를 입력해주세요");
    }

    // 사용자 중복 체크 (데이터베이스에 연결하고, users 컬렉션을 선택)
    var database = req.app.get('database');
    var users = database.collection('users');
    
 	// 중복 사용자 확인
    const existingUser = await users.findOne({ username: username });
    if (existingUser) {
      return res.status(409).send("이미 존재하는 사용자입니다");
    }
    
    // 비밀번호 암호화
    var salt = bcrypt.genSaltSync(saltrounds);
    var hash = bcrypt.hashSync(password, salt);
    
    // DB에 저장
    await users.insertOne({
      username: username,
      password: hash, // 해시된 비밀번호 저장
      nickname: nickname
    });
    res.status(201).send("사용자가 성공적으로 생성되었습니다");
  } catch (err) {
    console.error("사용자 추가 중 오류 발생:", err);
    res.status(500).send("서버 오류가 발생했습니다");
  }
});


// 로그인
router.post("/signin", async function(req, res, next) {
  try {
  	//username, password를 요청 본문에서 받아옴
    var username = req.body.username;
    var password = req.body.password;
	
    //데이터베이스에서 users 컬렉션을 가져옴
    var database = req.app.get('database');
    var users = database.collection('users');

    // 입력값 검증
    if (!username || !password) {
      return res.status(400).send("모든 필드를 입력해주세요.");
    }

	//사용자 인증
    //주어진 사용자 이름으로 DB에서 사용자를 찾고
    const existingUser = await users.findOne({ username: username });
    
    
    if (existingUser) {
      //비밀번호를 bcrypt.compareSync로 검증
      var compareResult = bcrypt.compareSync(password, existingUser.password);
      if (compareResult) {
        //비밀번호가 맞으면 세션을 설정하고 로그인 성공 상태를 반환
        req.session.isAuthenticated = true;
        req.session.userId = existingUser._id.toString();
        req.session.username = existingUser.username;
        req.session.nickname = existingUser.nickname;
        res.json({ result: ResponseType.SUCCESS });
      } else {
        //비밀번호가 틀리면 INVALID_PASSWORD를 반환
        res.json({ result: ResponseType.INVALID_PASSWORD });
      }
    } else {
      //사용자가 없으면 INVALID_USERNAME을 반환
      res.json({ result: ResponseType.INVALID_USERNAME });
    }
  } catch (err) {
    console.error("로그인 중 오류 발생.", err);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

// 로그아웃
router.post('/signout', function(req, res, next) {
  //req.session.destroy로 세션을 종료하고, 성공적으로 로그아웃되었다는 메시지 출력
  req.session.destroy((err) => {
    if (err) {
      console.log("로그아웃 중 오류 발생");
      return res.status(500).send("서버 오류가 발생했습니다.");
    }
    res.status(200).send("로그아웃 되었습니다.");
  });
});



//점수 추가
router.post('/addscore', async function(req, res, next) {
  try {
  	//로그인 여부 확인
    if (!req.session.isAuthenticated) {
      return res.status(400).send("로그인이 필요합니다.");
    }
    
    //로그인된 사용자의 userId와 점수를 요청 본문에서 받아옴
    var userId = req.session.userId;
    var score = req.body.score;

    // 점수 유효성 검사 (점수가 없거나 숫자가 아닌 경우)
    if (!score || isNaN(score)) {
      return res.status(400).send("유효한 점수를 입력해주세요.");
    }

	//데이터베이스에서 users 컬렉션을 가져옴
    var database = req.app.get('database');
    var users = database.collection('users');

	//점수 추가: 로그인한 사용자의 점수를 DB에 업데이트
    //MongoDB의 updateOne 메서드를 사용
    const result = await users.updateOne(
      //해당 userId를 ObjectId로 변환하여
      //mongodb에서 똑같은 해당 ObjectId를 가진 사용자의 정보를 찾음
      { _id: new ObjectId(userId) },
      {
      	//특정 필드 값을 변경하는 MongoDB의 연산자($set)를 사용
        $set: {
          //값이 숫자가 아닐 수도 있기 때문에 Number(score)로 변환하여 업데이트
          score: Number(score),
          //업데이트된 시각을 저장하여, 마지막으로 점수가 변경된 시간을 기록
          updatedAt: new Date()
        }
      }
    );
    
    //사용자를 찾지 못했다면
    //result.matchedCount는 업데이트가 적용된 문서의 개수
    //사용자를 찾지 못해 업데이트가 적용된 문서가 없다면(matchedCount === 0),
    if (result.matchedCount === 0) {
      return res.status(400).send("사용자를 찾을 수 없습니다.");
    }
    
    //업데이트 성공 시 응답 반환
    res.status(200).json({ message: "점수가 성공적으로 업데이트 되었습니다." });  
  } catch (err) {
    console.error("점수 추가 중 오류 발생: ", err);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});



// 점수 조회
router.get('/score', async function(req, res, next) {
  try {
  	//로그인 여부 확인
    if (!req.session.isAuthenticated) {
      return res.status(403).send("로그인이 필요합니다.");
    }

	//세션에 저장된 userId 값을 가져옴
    var userId = req.session.userId;
    
    //MongoDB에서 유저 컬렉션 가져오기
    var database = req.app.get('database');		//MongoDB 연결 객체
    var users = database.collection('users');	//users 컬렉션

	//문자열 ID를 MongoDB의 ObjectId 타입으로 변환
    const user = await users.findOne({ _id: new ObjectId(userId) });

	//user가 null이면, DB에 존재하지 않는 사용자라는 뜻이므로 404(Not Found) 응답
    if (!user) {
      return res.status(404).send("사용자를 찾을 수 없습니다.");
    }

	//_id 값을 문자열로 변환하여 반환. username과 nickname도 반환
    res.json({
      id: user._id.toString(),
      username: user.username,
      nickname: user.nickname,
      //점수가 있으면 반환하거 없으면 0 반환
      score: user.score || 0
    });
  } catch (err) {
    console.error("점수 조회 중 오류 발생: ", err);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

//이 라우터 파일을 외부에서 사용할 수 있도록 모듈화
module.exports = router;