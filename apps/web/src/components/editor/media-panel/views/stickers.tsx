import { DraggableMediaItem } from "@/components/ui/draggable-item";
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";


async function fetchGifs(searchTerm: string, setNext: Function, pos: string = "") {
  const response = await fetch("/api/tenor_gifs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchTerm, pos })

  })

  const data = await response.json()
  const { gifs, next } = data; // next and pos are the same thing, they both represent the position for the next batch of gifs

  if (next) setNext(next);
  return gifs;
}


function extractGifName(url: string) {
  const defaultName = `Gif${Date.now()}.gif`

  try {
    const urlObj = new URL(url)
    const segments = urlObj.pathname.split("/")
    const fileName = segments[segments.length - 1] || defaultName;

    return fileName

  } catch (error) {
    console.error("Error extracting GIF name: ", error, " defaulting to: ", defaultName);
    return defaultName;
  }


}


export function StickerView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState<string[]>([]);
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("NO GIFS")

  useEffect(() => {
    if (searchQuery === "") return;

    const delayDebounce = setTimeout(() => {
      setMsg("Loading GIFs...");
      fetchGifs(searchQuery, setNext, "")
      .then(urls => setGifs(urls))

    }, 1000); // 1 second delay

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  useEffect(() => {
    const gifsContainer = document.querySelector('.gifs');
    let isFetching = false;

    function handleScroll() {
      if (!gifsContainer) return;

      const isAtBottom =
        gifsContainer.scrollHeight - gifsContainer.scrollTop <= gifsContainer.clientHeight + 10;

      if (isAtBottom && !isFetching && searchQuery !== "" && next) {
        isFetching = true;

        fetchGifs(searchQuery, setNext, next).then((urls: string[]) => {
            const uniqueUrls = urls.filter((url: string) => !gifs.includes(url))
            if (uniqueUrls.length === 0) {
              setGifs(prev => [...prev, ...uniqueUrls]);

            }

            isFetching = false;

        });
      }
    }

    gifsContainer?.addEventListener('scroll', handleScroll);

    return () => gifsContainer?.removeEventListener('scroll', handleScroll);

  }, [gifs, next, searchQuery]);

  function handleSearch(searchTerm: string) {
    setGifs([])
    setSearchQuery(searchTerm);
  }


  return (
    <>
        <div className="search">
            {/* <input type="text" placeholder="Search GIFs on tenor..." style={searchStyle} /> */}
            <Input
                type="text"
                placeholder="Search GIFs on tenor..."
                className="min-w-[60px] flex-1 h-full text-xs mt-3 ml-2"
                value={searchQuery}
                onChange={(e) => {handleSearch(e.target.value)}}
                style={{ width: "95%" }}
            />

        </div>

        <div
          className="gifs grid p-4 mt-5"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            justifyContent: 'center',
            gap: '1rem',
            maxHeight: '50vh',
            overflowY: 'auto',
          }}
        >
          {gifs.length === 0 ? (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', margin: '2rem 0', fontWeight: 'bold', color: '#888' }} id="msg">
              {msg}
            </p>
          ) : null}
            {gifs.map((URL, index) => {
                return (
                    <div className="sticker w-1/2 sm:w-1/2 md:w-1/5 lg:w-1/6 xl:w-1/8 flex-grow-0 flex-shrink-0 ml-5" key={index} style={{ boxSizing: "border-box" }}>
                        <DraggableMediaItem
                            name="GIF"
                            preview={
                            <img
                                src={URL}
                                alt="Sticker Preview"
                                className="w-full h-full object-cover rounded tenor-gif" />
                            }
                            dragData={{
                                id: "STICKER",
                                type: "GIF",
                                name: extractGifName(URL),
                                content: URL
                            }}
                            aspectRatio={1}
                            showLabel={false}
                        />
                    </div>
                )})
            }
        </div>

    </>
  );
}

