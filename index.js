const fs = require('fs').promises;
const fsSync = require('fs');
const axios = require('axios').default;
const path = require('path')  
const puppeteer = require('puppeteer')

const checkLinks = () => new Promise (async (resolve, reject) => {
    try {
        var links = await fs.readFile('./links.json')
        links = JSON.parse(links)

        try {
            await fs.mkdir('./downloads');
            console.log('[#] download directory created')
        } catch (err) {
            console.log('[#] download directory exists')
        }

        resolve({
            status: "success",
            code: "read",
            message: "Reading 'links.json' file",
            data: links
        })
    } catch (ex) {
        if (ex.code == 'ENOENT') {
            await fs.writeFile('./links.json', JSON.stringify([{ url: ''}], null, 2), 'utf8');
            resolve({
                status: "success",
                code: "write",
                message: "File not found, please fill the nhen links on 'links.txt' file",
                data: []
            })
        } else {
            resolve({
                status: "error",
                code: "",
                message: ex,
                data: []
            })
        }
    }
});

const scrapPage = (url) => new Promise (async (resolve, reject) => {
    var details = {
        title: "",
        pages: "",
        code: "",
        albums: ""
    }

    try {
        var browser = await puppeteer.launch({
            headless: true
        });
    
        // expires till 2023-12-25
        const cookies = [
            {name: 'csrftoken', value: 'fpv1ISafAQ9ZERsnnkMvQdDDnm2b4wy0UDhoeJYX6BisMpWUh7I9UyCWlsDltkpG', domain: 'nhentai.net'},
            {name: 'cf_clearance', value: '3mRlDPsE31j.RYttRutwbNxdznWJ7VqZzC7MyW6xJ9I-1672045678-0-150', domain: '.nhentai.net'}
        ];
    
        var page = await browser.newPage();
        await page.setCookie(...cookies);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36')
    
        await page.goto(url, {
            waitUntil: 'networkidle0',
            ignoreHTTPSErrors: true
        });
    
        // title
        await page.waitForSelector('#info > h1 > span.pretty')
        var pageTitle = await page.waitForSelector('#info > h1 > span.pretty');
        pageTitle = await page.evaluate(el => el.textContent, pageTitle)
        details.title = pageTitle;
    
        // code
        await page.waitForSelector('#gallery_id')
        var pageCode = await page.waitForSelector('#gallery_id');
        pageCode = await page.evaluate(el => el.textContent, pageCode)
        details.code = pageCode.replace('#', '');
    
        // pages
        await page.waitForSelector('#tags > div:nth-child(8)')
        var pageNumber = await page.waitForSelector('#tags > div:nth-child(8)');
        pageNumber = await page.evaluate(el => el.textContent, pageNumber)
        pageNumber = pageNumber.trim().replaceAll(/\s/g,'').split(':')
        pageNumber = pageNumber[1];
        details.pages = pageNumber;
    
        // go to detail
        await page.goto(url +"1/", {
            waitUntil: 'networkidle0',
            ignoreHTTPSErrors: true
        });
    
        // albums
        await page.waitForSelector('#image-container > a > img');
        var pageAlbums = await page.waitForSelector('#image-container > a > img');
        pageAlbums = await page.$eval('#image-container > a > img', element => element.src);
        details.albums = pageAlbums;

        await browser.close();
        
        resolve({
            status: "success",
            message: "",
            data: details
        });
    } catch (err) {
        resolve({
            status: "error",
            message: err,
            data: details
        });
    }
    
});

const readPage = (details) => new Promise ((resolve, reject) => {
    try {
        for (var i = 0; i < details.length; i++) {
            var code = details[i].url.split("g/");
            code = code[1].replace(/[^\w\s]/gi, '');

            console.log('[#] Reading Page URL')
            scrapPage(details[i].url)
            .then(response => {
                console.log('[#] Trying to Download: ' + response.data.title.toString())

                // delete directory
                fsSync.rm('./downloads/' + response.data.title.toString(), { recursive: true, force: true }, (err) => {
                    if (err) { return console.error(err); }

                    // create directory
                    fsSync.mkdir('./downloads/' + response.data.title.toString(), (err) => {
                        if (err) { return console.error(err); }

                        // download
                        var album = response.data.albums.toString().split("/");
                        album = album[4];
            
                        for (var j = 1; j <= response.data.pages; j++) {
                            try {
                                wait(3000);
                                console.log("[+] Downloading page: " + j)

                                downloadImage(album, response.data.title.toString(), j);
                            } catch (exx) {
                                console.log("[x] Error Downloading page: " + j)
                            }
                        }
                    });
                })
            })
        }

        resolve({
            status: "success",
            message: "",
            data: []
        })
    } catch (ex) {
        resolve({
            status: "error",
            message: ex,
            data: []
        })
    }
});

async function downloadImage (code, directory, pages) {  
    const url = 'https://i3.nhentai.net/galleries/'+ code +'/'+ pages +'.jpg';
    const paths = path.resolve(__dirname, 'downloads/'+ directory, pages +'.jpg');
    const writer = fsSync.createWriteStream(paths)

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}

function wait(ms) {
    var start = Date.now(),
        now = start;
    while (now - start < ms) {
        now = Date.now();
    }
}

(async () => {
    var links = await checkLinks();
    if (links.status == 'success') {
        var read = await readPage(links.data);
        console.log(read)
    } else {
        console.log(links)
    }
})();