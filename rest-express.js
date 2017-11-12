const express = require('express')
var cors = require('cors')
var fs = require('fs')
const axios = require('axios')

async function main(){
	const app = express()
	const cfgPath = "./config.json"

	try{
		var cfg = JSON.parse(fs.readFileSync(cfgPath))
	}
	catch(err){
		console.log(err)
		process.exit(1)
	}

	console.log(cfg)

	var launches = await getLaunches()
	if(!launches){
		process.exit(1)
	}

	/* setInterval runs every 30 min */
	setInterval(async () => {
		let result = await getLaunches()
		/* If not null, update the launches array which the json api returns */
		if(result){
			launches = result
		}
	},	1800000)

	/* Enable cors headers */
	app.use(cors())

	/* Make sure connection closes after a request */
	app.use((req, res, next) => {
		res.setHeader('Connection', 'close')
		return next()
	})

	/* Listen for GET on /rest/launches, return the new json array */
	app.get('/rest/launches', (req, res) => {
		res.json(launches)
	})

	app.listen(cfg.port, () => {
		console.log('Server listening on port ' + cfg.port)
	})
}

/* Download latest launches array */
async function getLaunches(){
	console.log('Fetching new launches array')
	let launches
	try{
		launches = (await axios.get('https://launchlibrary.net/1.2/launch/next/20')).data.launches

		/* Copy wanted data only to a new object array. */
		var newLaunches = launches.map(launch => {
			var newLaunch = Object.assign({},
				{id: launch.id},
				{rocket: {imageURL: launch.rocket.imageURL}},
				{vidURLs: launch.vidURLs},
				{name: launch.name},
				{windowstart: launch.windowstart}
			)
			return newLaunch
		})
	}
	catch(err){
		console.log('getLaunches() failed, error: ' + err)
		newLaunches = null
	}

	return newLaunches
}

if(require.main === module){
	main()
}
