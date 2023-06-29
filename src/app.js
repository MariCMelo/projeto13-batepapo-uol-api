import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"


// Criação do app
const app = express()

// Configurações 
app.use(cors())
app.use(express.json())
dotenv.config()


//conexão com o banco
const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {
    await mongoClient.connect() // top level await
    console.log("MongoDB conectado!")
} catch (err) {
    (err) => console.log(err.message)
}

const db = mongoClient.db()

// Funções (endpoints)
app.get("/teste", (req, res) => {
    res.send("Funcionou!!")
})

// Ligar a aplicação do servidor para ouvir requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))