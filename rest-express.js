const express = require('express')
var cors = require('cors')
var fs = require('fs')
const axios = require('axios')
var https = require('https')
var each = require('async/each')
var Promise = require('promise')

var cfg
const cfgPath = "./config.json"

async function main(){
	const app = express()
	cfg = loadConfig(cfgPath)

	// Check that config exists
	if (!cfg) {
		console.log('Failed to open ' + cfgPath)
		process.exit(1)
	}

	var launches = await launchesModule.init()
	if(!launches){
		console.log('Failed to get launches array')
		process.exit(1)
	}

	/* setInterval runs every 30 min */
	setInterval(async () => {
		let result = await launchesModule.init()
		/* If not null, update the launches array which the json api returns */
		if(result){
			launches = result
		}
	}, 20000)

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

var launchesModule = {
	init: async () => {
		console.log(1)
		let launches = await launchesModule.get.allData()
		if(!launches){
			return null
		}

		console.log(2)
		/* Get the name and url of all images */
		let images = launchesModule.get.imageData(launches)

		console.log(3)
		/* Filter the list of images to only include new images */
		let newImages = await launchesModule.get.onlyNewImages(images);

		console.log(4)
		/* Download the images and save them to disk, if the image doesn't already exist */
		if( !(await launchesModule.helpers.saveToFile(newImages))){
			process.exit(1)
		}

		console.log(5)
		/* Extract wanted data only */
		let newLaunches = launchesModule.helpers.filter(launches, images)

		console.log(6)
		return newLaunches
	},
	get: {
		/* Download latest launches array */
		allData: async () => {
			console.log('Fetching new launches array')
			let launches
			try{
				launches = (await axios.get('https://launchlibrary.net/1.2/launch/next/20')).data.launches

			}
			catch(err){
				console.log('launches.get.all failed, error: ' + err)
				launches = null
			}
			return launches
		},
		imageData: launches => {
			let images

			images = launches.map(launch => {
				var image = Object.assign({},
					{name: launch.rocket.imageURL.split('/').pop(-1)},
					{url: launch.rocket.imageURL}
				)
				return image
			})
			return images
		},
		onlyNewImages: async (images) => {
			promises = images.map((image) => {
				return new Promise((resolve, reject) => {
					fs.access(cfg.imageFolderPath + image.name, (err) => {
						if(!err){
							resolve(false)
						}
						else{
							resolve(image)
						}
					})
				})
			})
			let newImages = await Promise.all(promises)

			let uniqueNewImages = []

			for(let i = 0; i < newImages.length; i++){
				let image = newImages[i]
				if(image){
					let addImage = true
					for(let j = 0; j < uniqueNewImages.length; j++){
						if(image.name === uniqueNewImages[j].name){
							addImage = false
						}
					}
					if(addImage){
						uniqueNewImages.push(image)
					}
				}
			}

			return uniqueNewImages


		}
	},
	helpers: {
		filter: (launches, images) => {
			/* Copy wanted data only to a new object array. */
			var newLaunches = launches.map((launch, index) => {
				var newLaunch = Object.assign({},
					{id: launch.id},
					{rocket: {imageURL: cfg.baseURL + cfg.imageURL + images[index].name}},
					{vidURLs: launch.vidURLs},
					{name: launch.name},
					{windowstart: launch.windowstart}
				)
				return newLaunch
			})

			return newLaunches
		},
		saveToFile: async (images) => {
			let success = true
			if(images.length === 0){
				return success
			}
			await each(images, (image) => { // await here?
				var file = fs.createWriteStream(cfg.imageFolderPath + image.name)
				file.on("error", (err) => {
					console.log("createWriteStream error: " + err)
					success = false
				})
				console.log('Downloading ' + image.name)
				var request = https.get(image.url, (response) => {
					let { statusCode } = response // destructuring assignment
					if (statusCode !== 200) {
						console.log("https.get error")
						success = false
					}
					response.pipe(file)
				})
			}, (err) => {
				console.log("Error saving image: " + err)
				success = false
			})
			return success
		},
	}
}

function loadConfig(){
	try{
		cfg = JSON.parse(fs.readFileSync(cfgPath))
		return cfg
	}
	catch(err){
		return false
	}
}

if(require.main === module){
	main()
}
