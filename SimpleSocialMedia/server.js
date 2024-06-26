const express = require("express");
const connection = require("./Connection");
const app = express();
const bodyParser = require("body-parser");
const path = require("path");
const jwt = require("jsonwebtoken");
const cookies = require("cookie-parser");

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to database: ", err);
    return;
  }
  console.log("Connected to database");
});

// Middleware
app.use(cookies());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

/* All get methods */
app.get("/register", (req, res) => {
  if (req.cookies.userRegistered) {
    res.redirect("/");
  } else {
    res.sendFile(path.join(__dirname, "register.html"));
  }
});

app.get("/login", (req, res) => {
  if (req.cookies.userRegistered) {
    res.redirect("/");
  } else {
    res.sendFile(path.join(__dirname, "login.html"));
  }
});

app.get("/", (req, res) => {
  if (req.cookies.userRegistered) {
    res.redirect("/homePage");
  } else {
    res.redirect("/login");
  }
});

app.get("/homePage", (req, res) => {
  let decoded;
  if (req.cookies.userRegistered) {
    try {
      decoded = jwt.verify(req.cookies.userRegistered, "1234");
    } catch (err) {
      console.error("JWT verification error:", err);
      return res.redirect("/login");
    }
    let id = decoded.id;

    connection.query(
      "SELECT * FROM students WHERE id = ?",
      [id],
      (err, result) => {
        if (err) {
          console.error("Error fetching student data:", err);
          return res.status(500).send("Internal Server Error");
        }

        if (result.length === 0) {
          return res.status(404).send("Student not found");
        }

        const sql =
          "SELECT posts.*, students.name AS studentsName FROM posts INNER JOIN students on posts.UserID = students.id ORDER BY posts.CreatedAt DESC;";
        connection.query(sql, (err, postsResult) => {
          if (err) {
            console.error("Error fetching posts:", err);
            return res.status(500).send("Internal Server Error");
          }
          res.render("index", { students: result[0], posts: postsResult });
        });
      }
    );
  } else {
    res.redirect("/login");
  }
});

app.get("/settings", (req, res) => {
  var sql = "SELECT * FROM students WHERE id=?";
  var id = req.query.id;

  connection.query(sql, [id], (err, result) => {
    if (err) console.log(err);
    res.render("settings", { student: result[0] });
  });
});

app.get("/settings/change-password", (req, res) => {
  connection.connect((error) => {
    if (error) console.log(error);

    var sql = "SELECT * FROM students WHERE id=?";

    const decoded = jwt.verify(req.cookies.userRegistered, "1234");
    const id = decoded.id;

    connection.query(sql, [id], (err, result) => {
      if (err) console.log(err);
      res.render("changepassword", {
        student: result[0],
        message: "",
      });
    });
  });
});

app.get("/logout", (req, res) => {
  res.clearCookie("userRegistered");
  res.redirect("/");
});

app.get("/students", (req, res) => {
  connection.connect((error) => {
    if (error) console.log(error);
    connection.query("SELECT * FROM students", (err, result) => {
      if (err) console.log(err);
      res.render("students", { students: result });
    });
  });
});

app.get("/delete-student", (req, res) => {
  connection.connect((error) => {
    if (error) console.log(error);

    var sql = "DELETE FROM students WHERE id = ?";
    var id = req.query.id;
    connection.query(sql, [id], (err, result) => {
      if (err) console.log(err);
      res.redirect("/students");
      // res.render(__dirname + "/students.ejs", { students: result });
    });
  });
});

app.get("/update-student", (req, res) => {
  connection.connect((error) => {
    if (error) console.log(error);

    var sql = "SELECT * FROM students WHERE id=?";
    var id = req.query.id;

    connection.query(sql, [id], (err, result) => {
      if (err) console.log(err);
      res.render("update-student", { student: result });
    });
  });
});

app.post("/posts", (req, res) => {
  const { postContent } = req.body;
  let decoded = jwt.verify(req.cookies.userRegistered, "1234");
  let id = decoded.id;

  connection.query(
    "INSERT INTO posts (UserID, Content) VALUES (?, ?)",
    [id, postContent],
    (err, results) => {
      if (err) {
        console.error("Error inserting post:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/homePage");
    }
  );
});

app.get("/posts", (req, res) => {
  const sql =
    "SELECT Posts.*, Students.Name FROM Posts JOIN Students ON Posts.UserID = Students.UserID ORDER BY CreatedAt DESC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching posts:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.render("/posts", { posts: results });
  });
});

// Get method to retrieve all posts

/* All post methods */
app.post("/register", (req, res) => {
  const { name, phone_no, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  connection.query(
    "INSERT INTO students (name, phone_no, email, password) VALUES (?, ?, ?, ?)",
    [name, phone_no, email, password],
    (err, results) => {
      if (err) {
        return res.status(500).send("Error registering user");
      }
      res.redirect("/login");
      // res.send("Registered successfully!");
    }
  );
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  connection.query(
    "SELECT * FROM students WHERE email = ?",
    [email],
    (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res
          .status(500)
          .send("An error occurred while retrieving user data");
      }

      if (results.length === 0) {
        return res.status(401).send("Invalid email or password");
      }

      const storedPassword = results[0].password;
      const uid = results[0].id;
      // Compare hashed password (recommended to hash passwords before storing)
      if (storedPassword !== password) {
        return res.status(401).send("Invalid email or password");
      }

      let token = jwt.sign({ id: uid }, "1234", { expiresIn: "10d" });
      let cookieOptions = {
        expiresIn: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        httpOnly: true,
      };
      res.cookie("userRegistered", token, cookieOptions);
      res.redirect("/");
    }
  );
});

app.post("/update-student", (req, res) => {
  connection.connect((error) => {
    if (error) console.log(error);

    var sql =
      "UPDATE students SET name=?, phone_no=?, email=?, password=? WHERE id=?";
    var { name, phone_no, email, password, id } = req.body;

    connection.query(
      sql,
      [name, phone_no, email, password, id],
      (err, result) => {
        if (err) console.log(err);
        res.redirect("/students");
      }
    );
  });
});

app.post("/settings/change-password", (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  const decoded = jwt.verify(req.cookies.userRegistered, "1234");
  const id = decoded.id;

  connection.query(
    "SELECT * FROM students WHERE id = ?",
    [id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.render("changepassword", {
          message: "DATABASE_QUERY_ERROR",
        });
      }

      const user = result[0];

      if (confirmNewPassword !== newPassword) {
        return res.render("changepassword", {
          message: "CONFIRM_PASSWORD_DOES_NOT_MATCH",
        });
      }
      if (user.password !== currentPassword) {
        return res.render("changepassword", {
          message: "CURRENT_PASSWORD_DOES_NOT_MATCH",
        });
      }

      connection.query(
        "UPDATE students SET password = ? WHERE id = ?",
        [newPassword, id],
        (err, result) => {
          if (err) {
            console.log(err);
            return res.render("changepassword", {
              message: "PASSWORD_UPDATE_FAILED",
            });
          }

          return res.render("changepassword", {
            message: "SUCCESS",
          });
        }
      );
    }
  );
});

app.locals.getTimeString = function (postDate) {
  let currentTime = new Date();
  let postTime = new Date(postDate);
  let timeDifference = (currentTime - postTime) / 1000;
  if (timeDifference < 60) {
    return "Few sec ago";
  } else if (timeDifference / 60 < 60) {
    return Math.floor(timeDifference / 60) + " min ago";
  } else if (timeDifference / (60 * 60) < 24) {
    return Math.floor(timeDifference / (60 * 60)) + " hour ago";
  } else {
    return Math.floor(timeDifference / (60 * 60 * 24)) + " day ago";
  }
};

// Start the server
app.listen(3000);
