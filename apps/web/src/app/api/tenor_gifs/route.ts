import { NextRequest, NextResponse } from "next/server";


export async function POST(request: NextRequest) {
    const { searchTerm, next} = await request.json()

    if (!searchTerm || typeof searchTerm != 'string' || searchTerm.trim() == "") return NextResponse.json({ error: "Missing search term." }, { status: 400 })

    const apikey: string = process.env.TENOR_API_KEY || ""
    if (!apikey) return NextResponse.json({ error: "API key is not set." }, { status: 500 })

    const clientkey = "openCut";
    const lmt = 20;

    let search_url = "https://tenor.googleapis.com/v2/search?q=" + searchTerm + "&key=" +
            apikey +"&client_key=" + clientkey +  "&limit=" + lmt + "&contentfilter=off";

    if (next) search_url += "&pos=" + next; // get new batch of gifs if next is provided

    try {
        const response = await fetch(search_url)
        if (!response.ok) return NextResponse.json({ error: "Failed to fetch data from Tenor API." }, { status: 500 })
        const data = await response.json()

        const gifs = data.results.map((gif: any) => gif.media_formats.gif.url);
        const next = data.next // this will be used to load more gifs when scrolling down
        return NextResponse.json({ gifs, next }, { status: 200 })

    } catch (err) {
        console.log("An error happend while loading stickers: ", err)
        return NextResponse.error()
    }

    
}
