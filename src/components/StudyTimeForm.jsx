import {useState} from "react";
import {
collection,
addDoc
} from "firebase/firestore";

import {db} from "../services/firebase";

import {useAuth} from "../context/AuthContext";


export default function StudyTimeForm(){

const [day,setDay]=useState("Senin");

const [start,setStart]=useState("");

const [end,setEnd]=useState("");

const {user}=useAuth();

function calculateDuration(start,end){


const startTime =
new Date(`2026-01-01T${start}`);


const endTime =
new Date(`2026-01-01T${end}`);



const diff =
(endTime-startTime)
/
(1000*60*60);



return Number(diff.toFixed(1));


}

async function saveStudyTime(){


if(!start || !end){

alert("Jam belajar belum lengkap");

return;

}



const duration =
calculateDuration(
start,
end
);



if(duration<=0){

alert(
"Jam selesai harus lebih besar dari jam mulai"
);

return;

}



await addDoc(

collection(db,"studyPreferences"),

{

userId:user.uid,

day,

startTime:start,

endTime:end,

duration,


createdAt:new Date()

}

);



alert(
"Waktu belajar berhasil disimpan"
);



setStart("");

setEnd("");

}

return(

<div className="
bg-white
rounded-2xl
shadow
p-6
">


<h2 className="
text-xl
font-bold
mb-5
">

⏰ Atur Waktu Belajar 

</h2>
<p className="
text-gray-500
mt-2
">

Masukkan waktu luang untuk belajar

</p>



<label className="
block
font-semibold
mb-2
">

Hari

</label>


<select

value={day}

onChange={(e)=>setDay(e.target.value)}

className="
w-full
border
rounded-xl
p-3
mb-4
"

>


<option>Senin</option>
<option>Selasa</option>
<option>Rabu</option>
<option>Kamis</option>
<option>Jumat</option>
<option>Sabtu</option>
<option>Minggu</option>


</select>






<label className="
block
font-semibold
mb-2
">

Jam Mulai

</label>


<input

type="time"

value={start}

onChange={(e)=>setStart(e.target.value)}

className="
w-full
border
rounded-xl
p-3
mb-4
"

/>





<label className="
block
font-semibold
mb-2
">

Jam Selesai

</label>


<input

type="time"

value={end}

onChange={(e)=>setEnd(e.target.value)}

className="
w-full
border
rounded-xl
p-3
mb-4
"

/>






<button

onClick={saveStudyTime}

className="
w-full
bg-gradient-to-r
from-blue-600
to-purple-600
text-white
py-3
rounded-xl
font-semibold
"

>

Simpan Waktu

</button>



</div>


)

}