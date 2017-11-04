
const express = require('express')
const app = express()

const axios = require('axios')

axios.get('https://launchlibrary.net/1.2/launch/next/20').then(res => {
	console.log(JSON.stringify(res.data.launches, null, "\t"))
})
