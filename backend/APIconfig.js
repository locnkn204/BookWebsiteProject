require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
app.use(express.json());
app.use(cors());

// kết nối tới cơ sở dữ liệu
// kết nối tới cơ sở dữ liệu
const dbConfig = {
  user: process.env.DB_USER,       // Doc user tu file .env
  password: process.env.DB_PASSWORD, // Doc password tu file .env
  server: process.env.DB_SERVER,     // Doc server tu file .env
  database: 'BookWebsite',
  options: {
    encrypt: true,
    trustServerCertificate: false
    // Bo di trustedConnection: true
  }
};
app.use('/data', express.static(path.join(__dirname, '../data'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp3')) {
      res.set('Content-Type', 'audio/mpeg');
    }
  }
}));


// đọc file txt
app.get('/read-file/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName; // Lấy tên file từ URL
    if (!fileName) {
      return res.status(400).send('Vui lòng cung cấp fileName trong URL');
    }

    const filePath = path.join(__dirname, 'data', fileName); // Tạo đường dẫn file
    console.log('Đang kiểm tra file tại:', filePath); // Debug đường dẫn

    if (!fs.existsSync(filePath)) {
      return res.status(404).send(`File không tồn tại: ${filePath}`);
    }

    if (!filePath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).send('Truy cập bị từ chối');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
  } catch (err) {
    res.status(500).send('Lỗi khi đọc file: ' + err.message);
  }
});


// kiểm tra kết nối
async function testConnection() {
  try {
    await sql.connect(dbConfig);
    console.log('Kết nối thành công!');
  } catch (err) {
    console.error('Lỗi kết nối:', err);
  }
}
testConnection();
// xây dựng API đăng nhập cho hàm admin

// xây dựng API cho lấy danh sách thể loại
app.get('/api/theloai', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool.request().query('SELECT * FROM THE_LOAI');
    res.json(result.recordset);
    pool.close();
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho tìm kiếm
app.get('/api/timkiem', async (req, res) => {
  try {
    const searchquery = req.query.query || '';

    let pool = await sql.connect(dbConfig);
    const a = 'Active';

    let result = await pool.request()
      .input("TENSACH", sql.NVarChar, `%${searchquery}%`)
      .input("TRANGTHAISACH", sql.NVarChar, a)
      .query('SELECT SACH.IDSACH, SACH.TENSACH, SACH.ANHBIA,SACH.TRANGTHAISACH FROM SACH WHERE SACH.TRANGTHAISACH = @TRANGTHAISACH AND TENSACH LIKE @TENSACH OR SACH.TACGIA LIKE @TENSACH OR SACH.NGUOIDOC LIKE @TENSACH') 
    if (result.recordset.length > 0) {
      res.status(200).json({
        ketquatimkiem: result.recordset,
        redirect: '/BodyBook.html'
      })
    } else {
      res.status(200).json({
        ketquatimkiem: [],
        redirect: '/BodyBook.html'
      });
    }
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// xây dựng API cho hiển thị sách ở trang chủ
app.get('/api/hienthisach', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool.request().query('SELECT SACH.TENSACH,SACH.ANHBIA,SACH.TRANGTHAISACH,SACH.IDSACH FROM SACH');
    res.json(result.recordset);
    pool.close();
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
})


// xây dựng API cho hiển thị chi tiết sách  ==> lưu ý về nhập liệu
app.post('/api/chitietsach', async (req, res) => {
  const { tensach } = req.body;
  let pool = await sql.connect(dbConfig);
  let a = 'Active'
  let result = await pool.request()
    .input("TENSACH", sql.Int, tensach)
    .input('TRANGTHAISACH',sql.NVarChar,a)
    .query('SELECT SACH.NGUOIDOC, SACH.IDSACH,SACH.TENSACH ,SACH.ANHBIA, SACH.TACGIA, THE_LOAI.TENTHELOAI, SACH.NHAXUATBAN,SACH.TRANGTHAIHOANTHANH,SACH.TOMTAT,SACH.NGAYCAPNHAT FROM SACH,THE_LOAI WHERE SACH.MATHELOAI = THE_LOAI.MATHELOAI AND SACH.IDSACH = @TENSACH AND SACH.TRANGTHAISACH = @TRANGTHAISACH' )
  if (result.recordset.length > 0) {
    res.status(200).json({
      book: result.recordset[0],
      redirect: '/GiaoDienTargetChitiet.html'
    });
  } else {
    res.status(200).json([]);
  }
})

// xây dựng API cho hiển thị bình luận ==> lưu ý về nhập liệu
app.post('/api/binhluan', async (req, res) => {
  const { tensach } = req.body;
  let pool = await sql.connect(dbConfig);
  let result = await pool.request()
    .input("TENSACH", sql.Int, tensach)
    .query('SELECT DANH_GIA.MADANHGIA,DANH_GIA.TENTAIKHOAN, DANH_GIA.NHANXET FROM SACH,DANH_GIA WHERE SACH.IDSACH = DANH_GIA.IDSACH AND SACH.IDSACH = @TENSACH')
  if (result.recordset.length > 0) {
    res.status(200).json({
      danhgia: result.recordset,
      redirect: '/GiaoDienTargetChitiet.html'
    });
  } else {
    res.status(200).json([]);
  }
})

// xây dựng API cho xóa bình luận
app.delete('/api/binhluan', async (req, res) => {
  const { madanhgia } = req.body;
  try {
    let pool = await sql.connect(dbConfig);
    let result1 = await pool.request()
      .input('madanhgia', sql.Int, madanhgia)
      .query('SELECT * FROM DANH_GIA WHERE DANH_GIA.MADANHGIA = @madanhgia');
    if (result1.recordset.length == 0)
      return res.status(400).json({ message: 'Bình luận không tồn tại' });

    let result = await pool.request()
      .input('madanhgia', sql.NVarChar, madanhgia)
      .query('DELETE FROM DANH_GIA WHERE DANH_GIA.MADANHGIA = @madanhgia');
    return res.status(200).json({ message: 'Xóa bình luận thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Xảy ra lỗi' });
  }
});

// xây dựng kiểm tra với tài khoản admin
app.get('/api/tkadmin', async (req, res) => {
  try {
    const searchquery = req.query.tentaikhoan || '';

    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input("TENTAIKHOAN_ADMIN", sql.NVarChar, searchquery)
      .query('SELECT * FROM ADMIN WHERE TENTAIKHOAN_ADMIN = @TENTAIKHOAN_ADMIN')
    if (result.recordset.length > 0) {
      res.status(200).json({
        message: 'Được cấp quyền admin'
      })
    } else {
      res.status(201).json({
        message: 'Không có quyền admin'
      });
    }
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});
// xây dựng API đăng xuất hàng loạt
app.post('/api/dangxuathangloat', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);

    let checkResult = await pool.request()
      .query('UPDATE TAI_KHOAN SET TAI_KHOAN.TRANGTHAIDANGNHAP = 0 WHERE TAI_KHOAN.TRANGTHAIDANGNHAP = 1');
    res.status(201).send('Đăng xuất thành công');

  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API kiểm tra trạng thái đăng nhập cho client
app.get('/api/trangthai', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool.request().query('SELECT TAI_KHOAN.TRANGTHAIDANGNHAP FROM TAI_KHOAN WHERE TAI_KHOAN.TRANGTHAIDANGNHAP = 1');
    if (result.recordset.length > 0) {
      return res.status(200).send('Đã đăng nhập');
    } else {
      return res.status(401).send('Chưa đăng nhập');
    }
    pool.close();
  } catch (err) {
    return res.status(500).send('Lỗi server: ' + err.message);
  }
})

// xây dựng API cho đăng kí
app.post('/api/dangki', async (req, res) => {
  const { taikhoan, matkhau, trangthaidangnhap } = req.body;
  if (!taikhoan || !matkhau) {
    return res.status(400).send('Thong tin tai khoan la bat buoc');
  }
  try {
    let pool = await sql.connect(dbConfig);

    const checkResult = await pool.request()
      .input('taikhoan', sql.NVarChar, taikhoan)
      .query('SELECT COUNT(*) as count FROM TAI_KHOAN WHERE TENTAIKHOAN = @taikhoan');
    if (checkResult.recordset[0].count > 0) {
      return res.status(409).send('Tai khoan da ton tai');
    }

    let result = await pool.request()
      .input('taikhoan', sql.NVarChar, taikhoan)
      .input('matkhau', sql.NVarChar, matkhau)
      .input('trangthaidangnhap', sql.Bit, trangthaidangnhap)
      .query('INSERT INTO TAI_KHOAN VALUES (@taikhoan,@matkhau,@trangthaidangnhap)');
    res.status(201).send('Đăng kí thành công');
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho đăng nhập
app.post('/api/dangnhap', async (req, res) => {
  const { taikhoan, matkhau } = req.body;
  try {
    let pool = await sql.connect(dbConfig);

    let result1 = await pool.request()
      .input('tentaikhoan', sql.NVarChar, taikhoan)
      .input('matkhau', sql.NVarChar, matkhau)
      .query('SELECT * FROM ADMIN WHERE ADMIN.TENTAIKHOAN_ADMIN = @tentaikhoan AND ADMIN.MATKHAU_ADMIN = @matkhau');
    if (result1.recordset.length > 0)
      return res.status(200).send("Đăng nhập quyền admin")
    let result = await pool.request()
      .input('tentaikhoan', sql.NVarChar, taikhoan)
      .input('matkhau', sql.NVarChar, matkhau)
      .query('SELECT * FROM TAI_KHOAN WHERE TAI_KHOAN.TENTAIKHOAN = @tentaikhoan AND TAI_KHOAN.MATKHAU = @matkhau');
    if (result.recordset.length > 0) {
      const checkResult = await pool.request()
        .input('tentaikhoan', sql.NVarChar, taikhoan)
        .query('UPDATE TAI_KHOAN SET TAI_KHOAN.TRANGTHAIDANGNHAP = 1 WHERE TAI_KHOAN.TENTAIKHOAN = @tentaikhoan');
      return res.status(201).send('Đăng nhập thành công');
    } else {
      return res.status(401).send('Tài khoản hoặc mật khẩu không đúng');
    }
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho đăng xuất
app.post('/api/dangxuat', async (req, res) => {
  const { taikhoan } = req.body;
  try {
    let pool = await sql.connect(dbConfig);

    let checkResult = await pool.request()
      .input('tentaikhoan', sql.NVarChar, taikhoan)
      .query('UPDATE TAI_KHOAN SET TAI_KHOAN.TRANGTHAIDANGNHAP = 0 WHERE TAI_KHOAN.TENTAIKHOAN = @tentaikhoan');
    res.status(201).send('Đăng xuất thành công');

  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho tìm kiếm theo thể loại
app.get('/api/timkiemtheloai', async (req, res) => {
  try {
    const searchquery = req.query.query || '';

    let pool = await sql.connect(dbConfig);
    const a = 'Active';
    let result = await pool.request()
      .input("TENTHELOAI", sql.NVarChar, searchquery)
      .input("TRANGTHAISACH", sql.NVarChar, a)
      .query('SELECT SACH.IDSACH, SACH.TENSACH, SACH.ANHBIA,SACH.TRANGTHAISACH FROM SACH,THE_LOAI WHERE SACH.MATHELOAI = THE_LOAI.MATHELOAI AND THE_LOAI.TENTHELOAI = @TENTHELOAI AND SACH.TRANGTHAISACH = @TRANGTHAISACH')
    if (result.recordset.length > 0) {
      res.status(200).json({
        ketquatimkiem: result.recordset,
        redirect: '/BodyBook.html'
      })
    } else {
      res.status(200).json([]);
    }
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// xây dựng API cho lưu trữ bình luận
app.post('/api/danhgia', async (req, res) => {
  const { tentaikhoan, masach, saodanhgia, nhanxet, ngaydanhgia } = req.body;
  try {
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input('tentaikhoan', sql.NVarChar, tentaikhoan)
      .input('masach', sql.Int, masach)
      .input('saodanhgia', sql.Int, saodanhgia)
      .input('nhanxet', sql.NVarChar, nhanxet)
      .input('ngaydanhgia', sql.Date, ngaydanhgia)
      .query('INSERT INTO DANH_GIA VALUES (@tentaikhoan,@masach,@saodanhgia,@nhanxet,@ngaydanhgia)');
    res.status(201).send('Đánh giá thành công');
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho thêm yêu thích
app.post('/api/yeuthich', async (req, res) => {
  const { tentaikhoan, masach, ngaythem } = req.body;
  try {
    let pool = await sql.connect(dbConfig);

    let check = await pool.request()
      .input('tentaikhoan', sql.NVarChar, tentaikhoan)
      .input('masach', sql.Int, masach)
      .query('SELECT * FROM SACH_YEU_THICH WHERE TENTAIKHOAN = @tentaikhoan AND IDSACH = @masach')
    if (check.recordset.length > 0)
      return res.status(409).send('Bạn đã thêm sách nào vào yêu thích');

    let result = await pool.request()
      .input('tentaikhoan', sql.NVarChar, tentaikhoan)
      .input('masach', sql.Int, masach)
      .input('ngaythem', sql.Date, ngaythem)
      .query('INSERT INTO SACH_YEU_THICH VALUES (@tentaikhoan,@masach,@ngaythem)');
    res.status(201).send('Lưu lại thành công');
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho xóa yêu thích
app.delete('/api/yeuthich', async (req, res) => {
  const { tentaikhoan, masach } = req.body;
  try {
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input('tentaikhoan', sql.NVarChar, tentaikhoan)
      .input('masach', sql.Int, masach) // Cập nhật kiểu từ Char sang Int cho IDSACH
      .query('DELETE FROM SACH_YEU_THICH WHERE TENTAIKHOAN = @tentaikhoan AND IDSACH = @masach');
    res.status(201).send('Xóa thành công');
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho hiển thị yêu thích
app.get('/api/yeuthich', async (req, res) => {
  try {
    const searchquery = req.query.query || '';
    let pool = await sql.connect(dbConfig);
    let trangthai = 'Active';
    let result = await pool.request()
      .input('tentaikhoan', sql.NVarChar, searchquery)
      .input('trangthai', sql.NVarChar, trangthai)
      .query('SELECT * FROM SACH_YEU_THICH,SACH WHERE SACH_YEU_THICH.IDSACH = SACH.IDSACH AND SACH_YEU_THICH.TENTAIKHOAN = @tentaikhoan AND SACH.TRANGTHAISACH = @trangthai');
    res.json(result.recordset);
    pool.close();
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
})

// xây dựng API tìm kiếm theo mã sách phần yêu thích
app.get('/api/timkiemmasach', async (req, res) => {
  try {
    const searchquery = req.query.query || '';
    const tentaikhoan = req.query.tentaikhoan || '';
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input("IDSACH", sql.Int, searchquery) // Cập nhật kiểu từ NVarChar sang Int cho IDSACH
      .input("TENTAIKHOAN", sql.NVarChar, tentaikhoan)
      .query('SELECT SACH.TRANGTHAISACH,SACH.IDSACH,SACH.TENSACH,SACH.MATHELOAI,SACH.TACGIA,SACH.NHAXUATBAN,SACH.NAMPHATHANH,SACH.TRANGTHAIHOANTHANH,SACH.ANHBIA,SACH.TOMTAT,SACH_YEU_THICH.TENTAIKHOAN FROM SACH,SACH_YEU_THICH WHERE SACH.IDSACH = SACH_YEU_THICH.IDSACH AND SACH.IDSACH = @IDSACH AND SACH_YEU_THICH.TENTAIKHOAN = @TENTAIKHOAN');
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

//============= lưu ý đặc biệt hàm này xây dựng hàm tìm kiếm cho noi dung sách  (hàm này coi chừng ==> cần phải chú ý đặc biệt)
app.get('/api/timkiemmasachnoidung', async (req, res) => {
  try {
    const { masach } = req.query; // Loại bỏ loainoidung khỏi req.query
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input("IDSACH", sql.Int, masach) // Chỉ giữ IDSACH
      .query('SELECT NOI_DUNG_SACH.DUONGDANPDF, NOI_DUNG_SACH.DUONGDANMP3 FROM NOI_DUNG_SACH WHERE NOI_DUNG_SACH.IDSACH = @IDSACH');
    if (result.recordset.length > 0)
      res.status(200).json(result.recordset);
    else
      res.status(404).json([]);
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// xây dựng API sửa tóm tắt sách
app.post('/api/tomtatsach', async (req, res) => {
  const { masach, tomtat } = req.body;
  try {
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input('masach', sql.Int, masach)
      .input('tomtat', sql.NVarChar, tomtat)
      .query('UPDATE SACH SET TOMTAT = @tomtat WHERE IDSACH = @masach');
    res.status(201).send('thành công');
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});



// Xây dựng API cho yêu cầu phân quyền ADMIN


// xây dựng API lấy danh sách tài khoản từ database
app.get('/api/listtaikhoan', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .query('SELECT * FROM TAI_KHOAN');
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// xây dựng API lấy danh sách cuốn sách từ database  
app.get('/api/listsach', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .query('SELECT * FROM SACH');
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// xây dựng API lấy nội dung sách
app.get('/api/listsachnoidung', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .query('SELECT * FROM NOI_DUNG_SACH');
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// xây dựng API xóa tài khoản ( xóa sách yêu thích + xóa đánh giá theo tài khoản => xóa 2 bảng này trước rồi mới xóa tài khoản)
app.delete('/api/listtaikhoan', async (req, res) => {
  const { tentaikhoan } = req.body;
  try {
    let pool = await sql.connect(dbConfig);
    // xóa danh sách yêu thích của tài khoản
    let result1 = await pool.request()
      .input('tentaikhoan', sql.NVarChar, tentaikhoan)
      .query('DELETE FROM SACH_YEU_THICH WHERE TENTAIKHOAN = @tentaikhoan');

    // xóa bình luận của tài khoản
    let result2 = await pool.request()
      .input('tentaikhoan', sql.NVarChar, tentaikhoan)
      .query('DELETE FROM DANH_GIA  WHERE TENTAIKHOAN = @tentaikhoan ');

    // xóa tài khoản
    let result = await pool.request()
      .input('tentaikhoan', sql.NVarChar, tentaikhoan)
      .query('DELETE FROM TAI_KHOAN WHERE TENTAIKHOAN = @tentaikhoan');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản để xóa' });
    }

    res.status(200).json({ message: 'Xóa tài khoản thành công' });
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho đổi mật khẩu
app.post('/api/doimatkhau', async (req, res) => {
  const { tentaikhoan, matkhau } = req.body;
  try {
    let pool = await sql.connect(dbConfig);
    const checkResult = await pool.request()
      .input('taikhoan', sql.NVarChar, tentaikhoan)
      .query('SELECT COUNT(*) as count FROM TAI_KHOAN WHERE TENTAIKHOAN = @taikhoan');
    if (checkResult.recordset[0].count == 0) {
      return res.status(409).json({ message: 'không có tài khoản' });
    }

    let result = await pool.request()
      .input('tentaikhoan', sql.NVarChar, tentaikhoan)
      .input('matkhau', sql.NVarChar, matkhau)
      .query('UPDATE TAI_KHOAN SET MATKHAU = @matkhau WHERE TENTAIKHOAN = @tentaikhoan');

    res.status(200).json({ message: 'đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho xóa sách 

// xây dựng API cho xóa sách 
app.post('/api/xoasach', async (req, res) => {
  const { masach } = req.body;
  try {
    let pool = await sql.connect(dbConfig);

    // xóa sách
    let trangthaihoatdong = 'Inactive';
    let ngaycapnhat = new Date();
    let result = await pool.request()
      .input('masach', sql.Int, masach)
      .input('ngaycapnhat', sql.Date, ngaycapnhat)
      .input('trangthaihoatdong', sql.NVarChar, trangthaihoatdong)
      .query('UPDATE SACH SET TRANGTHAISACH = @trangthaihoatdong, NGAYCAPNHAT = @ngaycapnhat WHERE IDSACH = @masach');


    res.status(201).send(ngaycapnhat);
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho kích hoạt sách

app.post('/api/kichhoat', async (req, res) => {
  const { masach } = req.body;
  try {
    let pool = await sql.connect(dbConfig);

    // xóa sách
    let trangthaihoatdong = 'Active';
    let ngaycapnhat = new Date();
    let result = await pool.request()
      .input('masach', sql.Int, masach)
      .input('ngaycapnhat', sql.Date, ngaycapnhat)
      .input('trangthaihoatdong', sql.NVarChar, trangthaihoatdong)
      .query('UPDATE SACH SET TRANGTHAISACH = @trangthaihoatdong,NGAYCAPNHAT = @ngaycapnhat WHERE IDSACH = @masach');
    res.status(201).send(ngaycapnhat);
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho thêm sách
app.post('/api/themsach', async (req, res) => {
  const { tensach, matheloai, tacgia, nhaxuatban, namphathanh, trangthai, anhbia, tomtat, trangthaihoatdong } = req.body; // Xóa masach khỏi req.body

  try {
    let pool = await sql.connect(dbConfig);

    const checkResult = await pool.request()
      .input('tensach', sql.NVarChar, tensach)
      .query('SELECT COUNT(*) as count FROM SACH WHERE TENSACH = @tensach');
    if (checkResult.recordset[0].count > 0) {
      return res.status(409).send('Sách đã tồn tại');
    }

    let result = await pool.request()
      .input('tensach', sql.NVarChar, tensach)
      .input('matheloai', sql.NVarChar, matheloai)
      .input('tacgia', sql.NVarChar, tacgia)
      .input('nhaxuatban', sql.NVarChar, nhaxuatban)
      .input('namphathanh', sql.Int, namphathanh)
      .input('trangthai', sql.NVarChar, trangthai)
      .input('anhbia', sql.NVarChar, anhbia)
      .input('tomtat', sql.NVarChar, tomtat)
      .input('trangthaihoatdong', sql.NVarChar, trangthaihoatdong)
      .query(`
        INSERT INTO SACH (TENSACH, MATHELOAI, TACGIA, NHAXUATBAN, NAMPHATHANH, TRANGTHAIHOANTHANH, ANHBIA, TOMTAT, TRANGTHAISACH)
        OUTPUT INSERTED.IDSACH as insertId
        VALUES (@tensach, @matheloai, @tacgia, @nhaxuatban, @namphathanh, @trangthai, @anhbia, @tomtat, @trangthaihoatdong)
      `);


    if (!result.recordset || result.recordset.length === 0) {
      return res.status(500).send('Không thể lấy ID sách mới');
    }
    const insertId = result.recordset[0].insertId;
    res.status(201).json({ insertId });
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API thêm nội dung cho sách
app.post('/api/themnoidung', async (req, res) => {
  const { masach, duongdanpdf, duongdanmp3 } = req.body; // Cập nhật req.body với masach, duongdanpdf, duongdanmp3
  try {
    let pool = await sql.connect(dbConfig);

    // thêm nội dung sách
    let result = await pool.request()
      .input('masach', sql.Int, masach) // Cập nhật kiểu từ Char sang Int cho IDSACH
      .input('duongdanpdf', sql.NVarChar, duongdanpdf)
      .input('duongdanmp3', sql.NVarChar, duongdanmp3)
      .query('INSERT INTO NOI_DUNG_SACH (IDSACH, DUONGDANPDF, DUONGDANMP3) VALUES (@masach, @duongdanpdf, @duongdanmp3)');
    res.status(201).send('Thêm thành công');
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

// xây dựng API cho tìm kiếm mã thể loại theo tên thể loại
app.get('/api/timkiemmatheloai', async (req, res) => {
  try {
    const searchquery = req.query.query || '';

    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input("TENTHELOAI", sql.NVarChar, searchquery)
      .query('SELECT THE_LOAI.MATHELOAI FROM THE LOAI WHERE TENTHELOAI = @TENTHELOAI')
    if (result.recordset.length > 0) {
      res.status(200).json({
        ketquatimkiem: result.recordset[0],
      })
    } else {
      res.status(200).json({
        ketquatimkiem: [], // Trả về object với ketquatimkiem là mảng rỗng
      });
    }


  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// xây dựng API cập nhật sách
app.post('/api/capnhatsach', async (req, res) => {
  const {
    idSach,
    tenSach,
    maTheLoai,
    tacGia,
    nhaXuatBan,
    namPhatHanh,
    trangThai,
    anhBia,
    tomTat,
    trangThaiHoatDong,
    duongdanpdf,
    duongdanmp3
  } = req.body; // Xóa maSach, pdf, audio; thêm duongdanpdf, duongdanmp3

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    // Kiểm tra sách tồn tại
    const checkResult = await pool.request()
      .input('idSach', sql.Int, req.body.idSach) // Cập nhật từ maSach sang idSach (IDSACH)
      .query('SELECT COUNT(*) as count FROM SACH WHERE IDSACH = @idSach');
    if (checkResult.recordset[0].count === 0) {
      return res.status(404).send('Sách không tồn tại');
    }

    // Cập nhật bảng SACH
    let query = 'UPDATE SACH SET ';
    const params = [];
    const request = pool.request();

    request.input('idSach', sql.Int, req.body.idSach); // Cập nhật từ maSach sang idSach (IDSACH)

    if (tenSach) {
      query += 'TENSACH = @tenSach, ';
      params.push({ name: 'tenSach', type: sql.NVarChar, value: tenSach });
    }
    if (maTheLoai) {
      query += 'MATHELOAI = @maTheLoai, ';
      params.push({ name: 'maTheLoai', type: sql.NVarChar, value: maTheLoai }); // Cập nhật kiểu từ Char sang NVarChar
    }
    if (tacGia) {
      query += 'TACGIA = @tacGia, ';
      params.push({ name: 'tacGia', type: sql.NVarChar, value: tacGia });
    }
    if (nhaXuatBan) {
      query += 'NHAXUATBAN = @nhaXuatBan, ';
      params.push({ name: 'nhaXuatBan', type: sql.NVarChar, value: nhaXuatBan });
    }
    if (namPhatHanh) {
      query += 'NAMPHATHANH = @namPhatHanh, ';
      params.push({ name: 'namPhatHanh', type: sql.Int, value: parseInt(namPhatHanh) });
    }
    if (trangThai) {
      query += 'TRANGTHAIHOANTHANH = @trangThai, '; // Cập nhật từ TRANGTHAI sang TRANGTHAIHOANTHANH
      params.push({ name: 'trangThai', type: sql.NVarChar, value: trangThai });
    }
    if (anhBia) {
      query += 'ANHBIA = @anhBia, ';
      params.push({ name: 'anhBia', type: sql.NVarChar, value: anhBia });
    }
    if (tomTat) {
      query += 'TOMTAT = @tomTat, ';
      params.push({ name: 'tomTat', type: sql.NVarChar, value: tomTat });
    }
    if (trangThaiHoatDong) {
      query += 'TRANGTHAISACH = @trangThaiHoatDong, '; // Cập nhật từ TRANGTHAIHOATDONG sang TRANGTHAISACH
      params.push({ name: 'trangThaiHoatDong', type: sql.NVarChar, value: trangThaiHoatDong }); // Cập nhật kiểu từ VarChar sang NVarChar
    }

    if (query !== 'UPDATE SACH SET ') {
      query = query.slice(0, -2) + ' WHERE IDSACH = @idSach'; // Cập nhật từ MASACH sang IDSACH
      params.forEach(param => request.input(param.name, param.type, param.value));
      await request.query(query);
    }

    // Xử lý nội dung sách
    if (duongdanpdf || duongdanmp3) {
      const checkNDS = await pool.request()
        .input('idSach', sql.Int, req.body.idSach) // Cập nhật từ maSach sang idSach (IDSACH)
        .query('SELECT COUNT(*) as count FROM NOI_DUNG_SACH WHERE IDSACH = @idSach');
      if (checkNDS.recordset[0].count > 0) {
        await pool.request()
          .input('idSach', sql.Int, req.body.idSach) // Cập nhật từ maSach sang idSach (IDSACH)
          .input('duongdanpdf', sql.NVarChar, duongdanpdf)
          .input('duongdanmp3', sql.NVarChar, duongdanmp3)
          .query('UPDATE NOI_DUNG_SACH SET DUONGDANPDF = @duongdanpdf, DUONGDANMP3 = @duongdanmp3 WHERE IDSACH = @idSach');
      } else {
        await pool.request()
          .input('idSach', sql.Int, req.body.idSach) // Cập nhật từ maSach sang idSach (IDSACH)
          .input('duongdanpdf', sql.NVarChar, duongdanpdf)
          .input('duongdanmp3', sql.NVarChar, duongdanmp3)
          .query('INSERT INTO NOI_DUNG_SACH (IDSACH, DUONGDANPDF, DUONGDANMP3) VALUES (@idSach, @duongdanpdf, @duongdanmp3)');
      }
    }

    let ngaycapnhat = new Date();
    let result1 = await pool.request()
      .input('ngaycapnhat', sql.Date, ngaycapnhat)
      .input('idsach', sql.Int, req.body.idSach)
      .query('UPDATE SACH SET NGAYCAPNHAT = @ngaycapnhat WHERE IDSACH = @idsach')

    const id = req.body.idSach;
    res.status(200).json({ id });
  } catch (err) {
    console.error('Lỗi chi tiết:', err.stack);
    res.status(500).send('Lỗi server: ' + err.message);
  } finally {
    if (pool) await pool.close();
  }
});

// lấy sách được thêm trong ngày này
app.get('/api/listsachthem', async (req, res) => {
  try {
    const ngaythem = req.query.query;
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input('ngaythem', sql.Date, ngaythem)
      .query('SELECT * FROM SACH WHERE NGAYTHEM = @ngaythem');
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// lấy sách được cập nahajt
app.get('/api/listsachcapnhat', async (req, res) => {
  try {
    const ngaythem = req.query.query;
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input('ngaythem', sql.Date, ngaythem)
      .query('SELECT * FROM SACH WHERE NGAYCAPNHAT = @ngaythem');
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// hiển thị bình luận
app.get('/api/hienthibinhluan', async (req, res) => {
  let pool = await sql.connect(dbConfig);
  let result = await pool.request()
    .query('SELECT SACH.TRANGTHAISACH,DANH_GIA.MADANHGIA,DANH_GIA.TENTAIKHOAN, DANH_GIA.NHANXET,SACH.IDSACH,DANH_GIA.NGAYDANHGIA,SACH.TENSACH,SACH.ANHBIA FROM SACH,DANH_GIA WHERE SACH.IDSACH = DANH_GIA.IDSACH ORDER BY DANH_GIA.NGAYDANHGIA DESC')
  res.json(result.recordset);
})

// tìm bình luận theo ngày thêm
app.get('/api/listngaythembinhluan', async (req, res) => {
  try {
    const ngaythem = req.query.query;
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input('ngaythem', sql.Date, ngaythem)
      .query('SELECT DANH_GIA.MADANHGIA,DANH_GIA.TENTAIKHOAN, DANH_GIA.NHANXET,SACH.IDSACH,DANH_GIA.NGAYDANHGIA,SACH.TENSACH,SACH.ANHBIA FROM SACH,DANH_GIA WHERE SACH.IDSACH = DANH_GIA.IDSACH AND DANH_GIA.NGAYDANHGIA = @ngaythem')
    res.json(result.recordset);
  } catch (err) {
    console.error('Lỗi:', err);
    res.status(500).json({ error: 'Lỗi server, vui lòng thử lại' });
  }
});

// xây dựng API cho lấy danh sách giọng đọc
app.get('/api/giongdoc', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool.request().query('select DISTINCT SACH.NGUOIDOC FROM SACH ORDER BY SACH.NGUOIDOC ASC');
    res.json(result.recordset);
    pool.close();
  } catch (err) {
    res.status(500).send('Lỗi server: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // Sửa lại dòng log để nó hiển thị đúng cổng đang chạy
  console.log(`Server is running on port ${PORT}`); 
  console.log('Kết nối thành công!');
});

