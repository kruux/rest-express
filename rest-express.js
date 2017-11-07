
const express = require('express')
var cors = require('cors')

var fs = require('fs')

const axios = require('axios')

const app = express()

/* Download latest launches object */
var launches
var newLaunches
var x = 'Anka'


axios.get('https://launchlibrary.net/1.2/launch/next/20').then(res => {
	launches = res.data.launches

	/* Copy wanted data only to a new object array. */
	newLaunches = launches.map(launch => {
		newLaunch = Object.assign({},
			{id: launch.id},
			{rocket: {imageURL: launch.rocket.imageURL}},
			{vidURLs: launch.vidURLs},
			{name: launch.name},
			{windowstart: launch.windowstart}
		)
		return newLaunch
	})
})

/* setInterval runs function every 3000 ms */
setInterval(() => {
	if(x == 'Anka'){
		x = 'Kalle'
	}
	else {
		x = 'Anka'
	}
	console.log(x)
},	3000)


/* Enable cors headers */
app.use(cors())

/* Listen for GET on /rest/launches, return the new json array */
app.get('/rest/launches', (req, res) => {
	res.json(newLaunches)
})

app.listen(3000, () => {
	console.log('Server listening on port 3000')
})
