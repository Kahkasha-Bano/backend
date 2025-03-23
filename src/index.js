//require('dotenv').config({path: './env'});
import dotenv from "dotenv"

//import mongoose from "mongoose";
//import { DB_NAME } from "./constants.js";
import connectDB from "./db/index.js";

dotenv.config({
    path: './env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        Console.log(`Server is running at port: $ {process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("MONGO DB connection failed !!!", err);
})












// import express from "express";
// const app=express();


// function connectDB(){}

// ;(async()=>{
//     try{
//      await  mongoose.connect(`&{process.env.MONGODB_URI}/${DB_NAME}`)
//      app.on("error" ,(error)=>{
//         console.log("ERROR", error);
//         throw error
//      })

//      app.listen(process.env.PORT, ()=> {
//         console.log(`App is listening on port ${process.env.PORT}`);
//      })
//     }catch(error){
//         console.log("ERROR: ",error);
//         throw err
//     }
// })()