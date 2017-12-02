const express = require('express')
var cors = require('cors')
var fs = require('fs')
const axios = require('axios')
var http = require('http')
var https = require('https')
var Promise = require('promise')

var cfg
const cfgPath = "./config.json"

async function main(){
	const app = express()
	cfg = loadConfig(cfgPath)

	// Check that config exists
	if (!cfg) {
		console.error('Failed to open ' + cfgPath)
		process.exit(1)
	}

	var launches = await launchesModule.init()
	if(!launches){
		console.error('Failed to get launches array')
		process.exit(1)
	}

	/* setInterval runs every 30 min */
	setInterval(async () => {
		let result = await launchesModule.init()
		/* If not null, update the launches array which the json api returns */
		if(result){
			launches = result
		}
	}, 1800000)

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
		console.error('Server listening on port ' + cfg.port)
	})
}

var launchesModule = {
	init: async () => {
		let launches = await launchesModule.get.allData()
		if(!launches){
			return null
		}

		/* Get the name and url of all images */
		let images = launchesModule.get.imageData(launches)

		/* Filter the list of images to only include new images */
		let newImages = await launchesModule.get.onlyNewImages(images);

		/* Download the images and save them to disk, if the image doesn't already exist */
		if( !(await launchesModule.helpers.saveToFile(newImages))){
			process.exit(1)
		}

		/* Extract wanted data only */
		let newLaunches = launchesModule.helpers.filter(launches, images)

		return newLaunches
	},
	get: {
		/* Download latest launches array */
		allData: async () => {
			let launches
			try{
				launches = (await axios.get('https://launchlibrary.net/1.2/launch/next/20')).data.launches
			}
			catch(err){
				console.error('launches.get.all failed, error: ' + err)
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
		/* Check which images already exists and return a list of those who doesn't */
		onlyNewImages: async (images) => {

			/* Save all images to a new list, without any duplicates */
			let uniqueImages = []
			for(let i = 0; i < images.length; i++){
				let image = images[i]
				let addImage = true
				for(let j = 0; j < uniqueImages.length; j++){
					if(image.name === uniqueImages[j].name){
						addImage = false
						break;
					}
				}
				if(addImage){
					uniqueImages.push(image)
				}
			}

			/* Check which, of the unique imagenames, exist inside the imagefolder */
			promises = uniqueImages.map((image) => {
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
			let uniqueNewImages = await Promise.all(promises)

			/* Filter out all the false resolves created in the Promise.all function */
			uniqueNewImages = uniqueNewImages.filter((image) => {return image})

			return uniqueNewImages
		}
	},
	helpers: {
		filter: (launches, images) => {
			/* Copy wanted data only to a new object array. */
			var newLaunches = launches.map((launch, i) => {
				var newLaunch = Object.assign({},
					{id: launch.id},
					{rocket: {imageURL: cfg.baseURL + cfg.imageURL + images[i].name}},
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
			/* Create a file for every image which doesn't already exist and download it from the original URL */
			let promises = images.map((image) => {
				return new Promise((resolve, reject) => {
					var file = fs.createWriteStream(cfg.imageFolderPath + image.name)
					file.on("error", (err) => {
						file.end()
						file.unlink()
						reject("createWriteStream error: " + err)
					})

					/* Determine whether the image is hosted via https or http */
					let req = image.url.substring(0,5) == 'https' ? https : http

					/* Request image stream */
					var request = req.get(image.url, (response) => {
						let { statusCode } = response // destructuring assignment
						if (statusCode !== 200) {
							file.end()
							file.unlink()
							reject("http(s).get error for " + image.name)
						}
						/* Save image stream to file */
						response.pipe(file)
						response.on('end', () => {
							file.end()
							resolve(true)
						})
					})
				})
			})

			try{
				await Promise.all(promises)
			}
			catch(err){
				console.error(err)
				return false
			}
			return true
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
