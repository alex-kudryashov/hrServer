const url = 'mongodb+srv://serverAdmin:1q2w3e4r5t@hrdb.ydu2z.mongodb.net/employees';

const port = process.env.PORT || 3000;
const index = '/index.html';
let collection;

const express = require('express');
const WebSocket = require('ws');
const {MongoClient} = require('mongodb');
const {ObjectId} = require('mongodb');

const client = new MongoClient(url, {useUnifiedTopology: true});
client.connect();

// запускаем сервер
const server = express()
    .use((req,res)=>{
        res.sendFile(index, {root: __dirname});
    }) 
    .listen(port, ()=>{
        console.log(`Server is running at port ${port}`);
    });

const wss = new WebSocket.Server({server});     // создаем веб сокет сервер



wss.on('connection', ws=>{
    newConnection(ws);
});  

async function newConnection(ws) {
    console.log('client connected');  
    collection = await client.db('hrAdminPanel').collection('employees'); //коллекция  
    // отправляем все записи при первом подключении клиента
    ws.send(JSON.stringify({type: 'postAll', data: await collection.find({}).toArray()}));

    ws.on('message', data=> {
        newMessage(data, ws)
    });
}

function newMessage(data, ws) {
    data = JSON.parse(data);
    switch(data.type) {
        case 'post': 
            postQ(data.data);
            break
        case 'delete': 
            deleteQ(data, ws)
            break
        case 'put':
            putQ(data, ws)
            break
        default:  
    }; 
}

function postQ(data) {
    let newID = new ObjectId();     //генерируем id для новой записи
    data['_id'] = newID;
    collection.insertOne(data);       //добавляем запись в базу

    // отправляем новую запись всем клиентам, в том числе текущему для получения id
    wss.clients.forEach(client=>{
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type: 'post', data}));
        }
    })
}

function deleteQ(data, ws) {
    collection.deleteOne({_id: ObjectId(data.id)});    //удаляем запись из базы

    // отправляем всем клиентам, кроме текущего, id записи для удаления 
    wss.clients.forEach(client=>{
        if (client.readyState === WebSocket.OPEN && client !== ws) {
            client.send(JSON.stringify({type: 'delete', data: data.id}))       
        }
    })
}

function putQ(data, ws) {
    let id = ObjectId(data.data._id)
    // обновляем запись в базе
    collection.updateOne(
        {_id: id},
        {$set:
            {
                name: data.data.name,
                position: data.data.position,
                salary: data.data.salary,
                status: data.data.status,
                recruitmentDate: data.data.recruitmentDate 
            }
        },
        {upsert: true}    
    )
    //отправляем всем клиентам кроме текущего новый вид записи 
    wss.clients.forEach(client=>{
        if (client.readyState === WebSocket.OPEN && client !== ws) {
            client.send(JSON.stringify({type: 'put', data: data.data}))   
        }
    })
}