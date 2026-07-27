import{c as z,r as a,j as e,u as I,t as g,a2 as P,a3 as E,m as V,a1 as R,h as M}from"./index-CtJfZhba.js";import{u as C}from"./useInfiniteDiscover-C_SaZjK1.js";import"./vendor-react-B3fs9643.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const O=[["path",{d:"M18.36 6.64A9 9 0 0 1 20.77 15",key:"dxknvb"}],["path",{d:"M6.16 6.16a9 9 0 1 0 12.68 12.68",key:"1x7qb5"}],["path",{d:"M12 2v4",key:"3427ic"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]],$=z("power-off",O);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U=[["path",{d:"M12 2v10",key:"mnfbl"}],["path",{d:"M18.4 6.6a9 9 0 1 1-12.77.04",key:"obofu9"}]],B=z("power",U),G="https://api.themoviedb.org/3",D="https://image.tmdb.org/t/p",X="8e887749d8a5b7a31b807aadd903d25a",Y=()=>{const[n,i]=a.useState([]),[p,h]=a.useState(0),[r,x]=a.useState(!1),[m,f]=a.useState(!0),[u,F]=a.useState(!0),[y,v]=a.useState("original"),S=[{id:1,name:"Breaking Bad",backdrop_path:"/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",poster_path:"/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",overview:"A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",first_air_date:"2008-01-20",vote_average:9.5,vote_count:15e3,genre_ids:[18,80],original_language:"en",popularity:450.5},{id:2,name:"Game of Thrones",backdrop_path:"/suopoADq0k8YZr4dQXcU6pToj6s.jpg",poster_path:"/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",overview:"Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war.",first_air_date:"2011-04-17",vote_average:8.4,vote_count:23e3,genre_ids:[10765,18],original_language:"en",popularity:380.3},{id:3,name:"Stranger Things",backdrop_path:"/56v2KjBlU4XaOv9rVYEQypROD7P.jpg",poster_path:"/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",overview:"When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",first_air_date:"2016-07-15",vote_average:8.7,vote_count:18e3,genre_ids:[18,10765],original_language:"en",popularity:420.7}],d=n.length>0?n:S;a.useEffect(()=>{let l=!1;return(async()=>{try{const w=[1,2,3],b=[];for(const o of w){const k=await(await fetch(`${G}/tv/popular?api_key=${X}&language=en-US&page=${o}`)).json();k.results&&b.push(...k.results)}const N=new Set,t=b.filter(o=>!o.backdrop_path||!o.overview||N.has(o.id)?!1:(N.add(o.id),!0));l||(i(t),f(!1))}catch{l||f(!1)}})(),()=>{l=!0}},[]),a.useEffect(()=>{p>=d.length&&h(0)},[d.length]),a.useEffect(()=>{const l=setInterval(()=>{x(!0),setTimeout(()=>{h(j=>(j+1)%d.length),x(!1)},800)},7e3);return()=>clearInterval(l)},[d.length]);const T=d.length>0?p%d.length:0,s=d[T];a.useEffect(()=>{v("original")},[s?.id]);const A=a.useMemo(()=>s?`${D}/${y}${s.backdrop_path}`:"",[s,y]);return s?e.jsxs("div",{className:"hero-tv-container",children:[e.jsxs("div",{className:"hero-tv-wrapper",children:[e.jsxs("div",{className:"hero-tv-frame",children:[e.jsx("div",{className:"hero-tv-backlight"}),e.jsx("div",{className:"hero-tv-inner-bezel",children:e.jsxs("div",{className:"hero-tv-screen relative",children:[e.jsxs("div",{className:"absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"h-8 w-8 rounded-lg logo-mark font-black text-lg flex items-center justify-center",children:"C"}),e.jsx("span",{className:"text-white font-bold text-sm tracking-wider",children:"CINEMAX"})]}),e.jsx("button",{onClick:()=>F(!u),className:"flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-white font-semibold transition-all cursor-pointer group",title:u?"Turn TV Off":"Turn TV On",children:u?e.jsxs(e.Fragment,{children:[e.jsx($,{className:"h-4 w-4 text-rose-400"}),e.jsx("span",{className:"text-xs",children:"Off"})]}):e.jsxs(e.Fragment,{children:[e.jsx(B,{className:"h-4 w-4 text-[#39FF14]"}),e.jsx("span",{className:"text-xs",children:"On"})]})})]}),e.jsx("div",{className:`hero-screen-content ${r?"fade":""} ${u?"":"opacity-0"}`,children:e.jsx("img",{src:A,alt:s.name||"Trending TV Series",className:"hero-backdrop-img",loading:"eager",onError:()=>{v(l=>l==="original"?"w1280":l)}},s.id)}),!u&&e.jsx("div",{className:"absolute inset-0 bg-black z-10"}),e.jsx("div",{className:"hero-show-info",children:e.jsxs("div",{className:"hero-info-content",children:[e.jsx("h2",{className:"hero-show-title",children:s.name||"Loading..."}),e.jsxs("div",{className:"hero-show-meta",children:[e.jsx("span",{className:"hero-year",children:s.first_air_date?.slice(0,4)||"N/A"}),e.jsxs("span",{className:"hero-rating",children:["⭐ ",s.vote_average?.toFixed(1)||"N/A"]}),e.jsx("span",{className:"hero-language",children:s.original_language?.toUpperCase()||"N/A"})]}),e.jsxs("p",{className:"hero-show-overview",children:[s.overview?.slice(0,150)||"Loading show information...",s.overview&&s.overview.length>150?"...":""]}),e.jsxs("div",{className:"hero-show-stats",children:[e.jsxs("span",{className:"hero-stat-item",children:[e.jsx("span",{className:"hero-stat-label",children:"Popularity"}),e.jsx("span",{className:"hero-stat-value",children:s.popularity?.toFixed(1)||"N/A"})]}),e.jsxs("span",{className:"hero-stat-item",children:[e.jsx("span",{className:"hero-stat-label",children:"Votes"}),e.jsx("span",{className:"hero-stat-value",children:s.vote_count?.toLocaleString()||"N/A"})]})]})]})},s.id),e.jsx("div",{className:"hero-screen-glare-reflection"})]})})]}),e.jsxs("div",{className:"hero-tv-legs-mount",children:[e.jsxs("div",{className:"tv-hardware-leg left-leg",children:[e.jsx("div",{className:"leg-vertical-stem"}),e.jsx("div",{className:"leg-angled-foot-base"})]}),e.jsxs("div",{className:"tv-hardware-leg right-leg",children:[e.jsx("div",{className:"leg-vertical-stem"}),e.jsx("div",{className:"leg-angled-foot-base"})]})]}),e.jsx("div",{className:"tv-green-smile-glow"})]}),e.jsx("style",{children:`
        .hero-tv-container {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem 1rem;
          background: transparent;
          box-sizing: border-box;
        }

        .hero-tv-wrapper {
          position: relative;
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* TV Frame with Ultra-Thin Metallic Black Bezel */
        .hero-tv-frame {
          position: relative;
          width: 100%;
          background: linear-gradient(145deg, #0a0a0a 0%, #000000 100%);
          border-radius: 8px;
          padding: 4px;
          box-sizing: border-box;
          z-index: 2;
        }

        /* Neon Green LED Backlight Glow - Radiating from sides and behind */
        .hero-tv-backlight {
          position: absolute;
          inset: -20px;
          background: radial-gradient(ellipse at center, rgba(57, 255, 20, 0.15) 0%, transparent 70%);
          border-radius: 16px;
          filter: blur(20px);
          z-index: -1;
          pointer-events: none;
        }

        .hero-tv-backlight::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(57, 255, 20, 0.3) 0%, transparent 15%, transparent 85%, rgba(57, 255, 20, 0.3) 100%),
            linear-gradient(180deg, rgba(57, 255, 20, 0.2) 0%, transparent 20%, transparent 80%, rgba(57, 255, 20, 0.2) 100%);
          border-radius: 16px;
          filter: blur(15px);
        }

        /* Ultra-thin metallic black inner bezel with 16:9 cinema aspect ratio */
        .hero-tv-inner-bezel {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #000000;
          overflow: hidden;
          border: 2px solid #1a1a1a;
          box-shadow:
            inset 0 0 20px rgba(0, 0, 0, 0.8),
            0 0 0 1px rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 768px) {
          .hero-tv-inner-bezel {
            aspect-ratio: 16 / 9;
          }
        }

        .hero-tv-screen {
          position: relative;
          width: 100%;
          height: 100%;
          background: #000;
        }

        .hero-screen-content {
          width: 100%;
          height: 100%;
          opacity: 1;
          transition: opacity 0.8s ease-in-out;
        }

        .hero-screen-content.fade {
          opacity: 0;
        }

        .hero-backdrop-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          min-height: 300px;
          background: #1a1a1a;
        }

        .hero-screen-glare-reflection {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.04) 0%,
            transparent 40%
          );
          pointer-events: none;
        }

        /* Show Information Overlay */
        .hero-show-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 4.5rem 2rem 2rem;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.96) 0%,
            rgba(0, 0, 0, 0.9) 35%,
            rgba(0, 0, 0, 0.65) 70%,
            rgba(0, 0, 0, 0.25) 100%
          );
          pointer-events: none;
          z-index: 10;
        }

        .hero-info-content {
          max-width: 600px;
        }

        .hero-show-title {
          font-size: 1.8rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 0.75rem 0;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 1), 0 0 24px rgba(0, 0, 0, 0.6);
          line-height: 1.2;
        }

        .hero-show-meta {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .hero-year,
        .hero-rating,
        .hero-language {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
        }

        .hero-rating {
          color: #fbbf24;
        }

        .hero-show-overview {
          font-size: 0.95rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.5;
          margin: 0 0 1rem 0;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .hero-show-stats {
          display: flex;
          gap: 1.5rem;
        }

        .hero-stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .hero-stat-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .hero-stat-value {
          font-size: 0.9rem;
          font-weight: 700;
          color: #39FF14;
          text-shadow: 0 0 8px rgba(57, 255, 20, 0.4);
        }

        /* Stance layout for the dual support stands positioned out near the frame margins */
        .hero-tv-legs-mount {
          width: 90%;
          display: flex;
          justify-content: space-between;
          position: relative;
          height: 50px;
          margin-top: -2px;
          pointer-events: none;
          z-index: 1;
        }

        .tv-hardware-leg {
          position: relative;
          width: 80px;
          height: 100%;
        }

        /* Vertical stem connecting to TV frame */
        .leg-vertical-stem {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 20px;
          background: linear-gradient(180deg, #39FF14 0%, #2ed011 100%);
          box-shadow:
            0 0 15px #39FF14,
            0 0 30px rgba(57, 255, 20, 0.6);
          border-radius: 2px;
        }

        /* Thick, bold, chunky outward-flaring neon green leg (Left Stand) */
        .left-leg .leg-angled-foot-base {
          position: absolute;
          top: 18px;
          left: 50%;
          transform: translateX(-50%) rotate(25deg);
          transform-origin: top center;
          width: 24px;
          height: 40px;
          background: linear-gradient(180deg, #39FF14 0%, #2ed011 100%);
          box-shadow:
            0 0 25px #39FF14,
            0 0 50px rgba(57, 255, 20, 0.8),
            -4px 8px 15px rgba(0, 0, 0, 0.7);
          border-radius: 6px;
        }

        /* Thick, bold, chunky outward-flaring neon green leg (Right Stand) */
        .right-leg .leg-angled-foot-base {
          position: absolute;
          top: 18px;
          left: 50%;
          transform: translateX(-50%) rotate(-25deg);
          transform-origin: top center;
          width: 24px;
          height: 40px;
          background: linear-gradient(180deg, #39FF14 0%, #2ed011 100%);
          box-shadow:
            0 0 25px #39FF14,
            0 0 50px rgba(57, 255, 20, 0.8),
            4px 8px 15px rgba(0, 0, 0, 0.7);
          border-radius: 6px;
        }

        /* Ambient glowing smile light reflex under TV */
        .tv-green-smile-glow {
          position: absolute;
          bottom: -35px;
          width: 80%;
          height: 25px;
          background: radial-gradient(ellipse at center, rgba(57, 255, 20, 0.5) 0%, rgba(57, 255, 20, 0.15) 40%, transparent 70%);
          border-radius: 50%;
          filter: blur(10px);
          z-index: 0;
          pointer-events: none;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .hero-tv-wrapper {
            max-width: 100%;
          }

          .hero-tv-frame {
            padding: 3px;
          }

          .hero-tv-legs-mount {
            width: 85%;
            height: 40px;
          }

          .tv-hardware-leg {
            width: 60px;
          }

          .leg-vertical-stem {
            width: 8px;
            height: 15px;
          }

          .left-leg .leg-angled-foot-base,
          .right-leg .leg-angled-foot-base {
            width: 18px;
            height: 30px;
            top: 14px;
          }

          .tv-green-smile-glow {
            bottom: -25px;
            height: 18px;
          }

          .hero-show-info {
            padding: 3.25rem 1.5rem 1.5rem;
          }

          .hero-show-title {
            font-size: 1.4rem;
          }

          .hero-show-overview {
            font-size: 0.85rem;
            -webkit-line-clamp: 2;
          }

          .hero-show-stats {
            gap: 1rem;
          }
        }
      `})]}):null},_=[{id:"trending",label:"Trending Now",fetch:async n=>{const i=await g.getTrendingTVShows(n);if(n===1){const p=await g.getTrendingTVShows(2),h=await g.getTrendingTVShows(3);return{results:[...i,...p,...h],totalPages:500}}return{results:i,totalPages:500}}},{id:"popular",label:"Popular",fetch:async n=>({results:await g.getPopularTVShows(n),totalPages:500})},{id:"top_rated",label:"Top Rated",fetch:async n=>({results:await g.getTopRatedTVShows(n),totalPages:500})},{id:"airing_today",label:"Airing Today",fetch:async n=>({results:await g.getAiringTodayTVShows(n),totalPages:500})},{id:"on_the_air",label:"Featured / On The Air",fetch:async n=>({results:await g.getOnTheAirTVShows(n),totalPages:500})}],L=()=>e.jsxs("div",{className:"flex-none w-32 sm:w-36 md:w-40 rounded-2xl overflow-hidden bg-white/5 border border-white/5 animate-pulse relative",children:[e.jsx("div",{className:"aspect-[2/3] bg-gradient-to-br from-white/5 to-white/[0.02]"}),e.jsx("div",{className:"absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"}),e.jsxs("div",{className:"p-3 space-y-2",children:[e.jsx("div",{className:"h-3 bg-white/10 rounded w-3/4"}),e.jsx("div",{className:"h-2.5 bg-white/5 rounded w-1/2"})]})]}),q=({title:n,shows:i,loading:p,onSeeAll:h,onShowClick:r,seeAllLabel:x="See All"})=>e.jsxs("div",{className:"space-y-4 w-full",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 lg:px-8",children:[e.jsxs("h3",{className:"font-sans font-extrabold text-lg sm:text-xl text-white flex items-center gap-3",children:[e.jsx("span",{className:"h-6 w-1.5 bg-gradient-to-b from-[#39FF14] to-[#31dd11] rounded-full shadow-[0_0_15px_rgba(57,255,20,0.5)]"}),n]}),e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx(R,{}),e.jsxs("button",{onClick:h,className:"group flex items-center gap-2 text-xs font-bold text-[#39FF14] hover:text-[#31dd11] transition-all duration-300 cursor-pointer",children:[e.jsx("span",{className:"group-hover:translate-x-0.5 transition-transform",children:x})," ",e.jsx(M,{className:"h-4 w-4 group-hover:translate-x-1 transition-transform"})]})]})]}),e.jsx("div",{className:"flex gap-3 overflow-x-auto pb-4 w-full scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent",children:p&&i.length===0?Array.from({length:10}).map((m,f)=>e.jsx(L,{},f)):i.map(m=>e.jsx(V,{movie:m,onClick:()=>r(m)},m.id))})]}),J=({onShowClick:n})=>{const{t:i}=I(),[p,h]=a.useState([]),[r,x]=a.useState(null),[m,f]=a.useState(""),[u,F]=a.useState({}),[y,v]=a.useState(!0);a.useEffect(()=>{g.getGenres("tv").then(h).catch(()=>h([]))},[]),a.useEffect(()=>{if(r!==null)return;let t=!1;return v(!0),(async()=>{const o=await Promise.all(_.map(async c=>{const{results:k}=await c.fetch(1).catch(()=>({results:[],totalPages:1}));return[c.id,k]}));t||(F(Object.fromEntries(o)),v(!1))})(),()=>{t=!0}},[r]);const S=a.useMemo(()=>{if(r===null)return null;const t=_.find(c=>c.id===r);if(t)return t.fetch;const o=Number(r.replace("genre-",""));return c=>g.discoverTVByGenre(o,c)},[r]),{items:d,loading:T,initialLoading:s,hasMore:A,loadMore:l}=C(S||(async()=>({results:[],totalPages:1})),r||"none"),j=a.useRef(null);a.useEffect(()=>{if(r===null)return;const t=j.current;if(!t)return;const o=new IntersectionObserver(c=>{c[0]&&c[0].isIntersecting&&l()},{rootMargin:"600px"});return o.observe(t),()=>o.disconnect()},[r,l]);const w=(t,o)=>{x(t),f(o)},b=t=>i(`collection.${t.id}`),N=t=>i(`genre.${t}`);return e.jsxs("div",{id:"tv-shows-page",className:"w-full min-h-screen bg-black text-white pb-12 overflow-x-hidden",children:[r===null&&e.jsx("div",{className:"w-full px-0 sm:px-4 lg:px-8 pt-2",children:e.jsx(Y,{})}),e.jsxs("div",{className:"px-4 lg:px-8 space-y-6 mt-8",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs("div",{className:"relative",children:[e.jsx("div",{className:"absolute inset-0 bg-[#39FF14]/20 rounded-xl blur-lg"}),e.jsx(P,{className:"relative h-6 w-6 text-[#39FF14]"})]}),e.jsx("h1",{className:"font-sans font-black text-2xl sm:text-3xl text-white tracking-tight",children:r===null?i("exploreTvShows"):m})]}),e.jsxs("div",{className:"flex items-center gap-2 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent",children:[e.jsxs("button",{onClick:()=>x(null),className:`flex-none flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-full border transition-all duration-300 cursor-pointer ${r===null?"bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black border-[#39FF14] shadow-[0_4px_15px_rgba(57,255,20,0.4)]":"bg-white/5 text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.08]"}`,children:[e.jsx(E,{className:"h-3.5 w-3.5"})," ",i("browse")]}),_.map(t=>e.jsx("button",{onClick:()=>w(t.id,b(t)),className:`flex-none text-xs font-bold px-4 py-2.5 rounded-full border transition-all duration-300 cursor-pointer ${r===t.id?"bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black border-[#39FF14] shadow-[0_4px_15px_rgba(57,255,20,0.4)]":"bg-white/5 text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.08]"}`,children:b(t)},t.id)),p.map(t=>e.jsx("button",{onClick:()=>w(`genre-${t.id}`,N(t.name)),className:`flex-none text-xs font-bold px-4 py-2.5 rounded-full border transition-all duration-300 cursor-pointer ${r===`genre-${t.id}`?"bg-gradient-to-r from-[#39FF14] to-[#31dd11] text-black border-[#39FF14] shadow-[0_4px_15px_rgba(57,255,20,0.4)]":"bg-white/5 text-neutral-300 border-white/10 hover:border-white/30 hover:bg-white/[0.08]"}`,children:N(t.name)},t.id))]})]}),e.jsx("div",{className:"mt-10 w-full",children:r===null?e.jsx("div",{className:"space-y-12 w-full",children:_.map(t=>e.jsx(q,{title:b(t),shows:u[t.id]||[],loading:y,onSeeAll:()=>w(t.id,b(t)),onShowClick:n},t.id))}):e.jsx("div",{className:"px-4 lg:px-8 space-y-8 w-full",children:s?e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-6",children:Array.from({length:14}).map((t,o)=>e.jsx(L,{},o))}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-6 w-full",children:d.map(t=>e.jsx("div",{className:"w-full transition-transform duration-300 hover:scale-105",children:e.jsx(V,{movie:t,onClick:()=>n(t)})},t.id))}),e.jsxs("div",{ref:j,className:"flex justify-center py-8 w-full",children:[T&&e.jsxs("div",{className:"flex items-center gap-3 text-xs text-neutral-500",children:[e.jsx("div",{className:"h-5 w-5 rounded-full border-2 border-[#39FF14]/30 border-t-[#39FF14] animate-spin"}),e.jsx("span",{className:"font-medium",children:"Loading more titles..."})]}),!A&&d.length>0&&e.jsxs("div",{className:"flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10",children:[e.jsx("div",{className:"w-2 h-2 rounded-full bg-[#39FF14]"}),e.jsx("p",{className:"text-xs text-neutral-400 font-medium",children:i("noMoreResults")})]})]})]})})})]})};export{J as TVShowsPage};
