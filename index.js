const express = require("express");
const rootRouter = require("./src/routes/rootRouter");

const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  cors({
    // origin: "http://localhost:3000", // allow React
    origin: "*", // allow all origins(for testing purposes)

    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
  })
);

// mount API at /api
app.use("/api", rootRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
