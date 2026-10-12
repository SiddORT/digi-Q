// Network replacement for disposable integration tests. Never opens a socket.
export const keepInTouchNetworkPlugin = {
  name: "keep-in-touch-fake-network",
  setup(b) {
    b.onResolve({filter:/^node:(https|dns\/promises)$/},args=>({path:args.path,namespace:"kit-network"}));
    b.onLoad({filter:/.*/,namespace:"kit-network"},args=>({contents:args.path.includes("dns") ?
      `export const lookup=async()=>[{address:"8.8.8.8",family:4}];` :
      `import {EventEmitter} from "node:events";
       export function request(url,options,callback){
         const req=new EventEmitter();req.destroy=()=>{};
         req.end=body=>{
           globalThis.kitNetwork.push({url:String(url),options,body:JSON.parse(body)});
           queueMicrotask(()=>{
             const socket=new EventEmitter();req.emit("socket",socket);socket.emit("secureConnect");
             const res=new EventEmitter();res.statusCode=200;callback(res);
             res.emit("data",Buffer.from(JSON.stringify(globalThis.kitResponse??{success:true,message:"private diagnostic"})));
             res.emit("end");
           });
         };return req;
       }`
    }));
  },
};
