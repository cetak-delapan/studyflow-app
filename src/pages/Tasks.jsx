import { useState, useEffect } from "react";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";

import { db } from "../services/firebase";

import { useAuth } from "../context/AuthContext";

import TaskCard from "../components/TaskCard";

import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import MobileNavbar from "../components/MobileNavbar";

import { useSidebar } from "../context/SidebarContext";


export default function Tasks() {


const {
collapsed
}=useSidebar();


const {
user
}=useAuth();




const [tasks,setTasks]=useState([]);

const [filter,setFilter]=useState("pending");


// untuk edit

const [editingTask,setEditingTask]=useState(null);





const [task,setTask]=useState({

title:"",
course:"",
deadline:"",
duration:"",
priority:"High",
progress:0

});







async function fetchTasks(){


if(!user) return;



const q=query(

collection(db,"tasks"),

where(
"userId",
"==",
user.uid
)

);



const snapshot=await getDocs(q);



const data=snapshot.docs.map((item)=>(

{

id:item.id,

...item.data()

}

));



setTasks(data);


}






useEffect(()=>{


if(user){

fetchTasks();

}


},[user]);







function handleChange(e){


setTask({

...task,

[e.target.name]:e.target.value

});


}



async function updateProgress(id,value){


await updateDoc(

doc(db,"tasks",id),

{

progress:value

}

);


fetchTasks();


}





async function addTask(){



if(!task.title || !task.deadline){


alert(
"Nama tugas dan deadline wajib diisi"
);


return;


}





await addDoc(

collection(db,"tasks"),

{


...task,


duration:Number(task.duration),


userId:user.uid,


status:"pending",
progress:0,

createdAt:new Date()


}

);






setTask({

title:"",
course:"",
deadline:"",
duration:"",
priority:"High"

});




fetchTasks();



}









async function deleteTask(id){


await deleteDoc(

doc(db,"tasks",id)

);



fetchTasks();



}









async function completeTask(id){


await updateDoc(

doc(db,"tasks",id),

{

status:"completed",

progress:100

}

);


fetchTasks();


}









// buka modal edit


function editTask(task){


setEditingTask(task);


}









// simpan perubahan


async function updateTask(){


await updateDoc(

doc(

db,

"tasks",

editingTask.id

),

{


title:editingTask.title,


course:editingTask.course,


deadline:editingTask.deadline,


duration:Number(editingTask.duration),


priority:editingTask.priority,

progress:Number(editingTask.progress)

}

);





setEditingTask(null);



fetchTasks();



}








const filteredTasks=tasks.filter(

(item)=>

item.status===filter

);






return (

<div className="
flex
min-h-screen
bg-gray-100
">



<Sidebar/>





<main

className={`

flex-1

p-8

transition-all

duration-300


${
collapsed

?

"ml-20"

:

"ml-64"

}

`}

>



<MobileNavbar/>


<Navbar/>




<div className="
flex
justify-between
items-center
mb-8
">


<div>


<h1 className="
text-4xl
font-bold
text-gray-800
">

📝 Tugas Saya

</h1>



<p className="
text-gray-500
mt-2
">

Kelola tugas kuliah dan aktivitas belajar kamu dengan lebih teratur.

</p>


</div>




<div className="
bg-white
px-5
py-3
rounded-full
shadow
">

📝 Pengelola Tugas

</div>



</div>
{/* CONTENT GRID */}

<div className="
grid
grid-cols-1
xl:grid-cols-3
gap-8
">






{/* FORM TAMBAH TUGAS */}


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

Tambah Tugas

</h2>





<label className="
block
font-semibold
mb-2
">

Nama Tugas

</label>


<input

name="title"

value={task.title}

placeholder="Contoh: Laporan Basis Data"

onChange={handleChange}

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

Mata Kuliah

</label>


<input

name="course"

value={task.course}

placeholder="Contoh: Sistem Informasi"

onChange={handleChange}

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

Deadline Penyelesaian

</label>


<input

type="date"

name="deadline"

value={task.deadline}

onChange={handleChange}

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

Durasi Pengerjaan (Jam)

</label>


<p className="
text-sm
text-gray-500
mb-2
">

Perkiraan waktu yang dibutuhkan untuk menyelesaikan tugas.

</p>


<input

type="number"

name="duration"

value={task.duration}

placeholder="Contoh: 8"

onChange={handleChange}

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

Prioritas Tugas

</label>


<select

name="priority"

value={task.priority}

onChange={handleChange}

className="
w-full
border
rounded-xl
p-3
mb-5
"

>


<option value="High">
Tinggi
</option>


<option value="Medium">
Sedang
</option>


<option value="Low">
Rendah
</option>


</select>







<button

onClick={addTask}

className="
w-full
bg-gradient-to-r
from-blue-600
to-purple-600
text-white
py-3
rounded-xl
font-semibold
hover:scale-105
transition
"

>

Simpan Tugas

</button>





</div>









{/* LIST TUGAS */}


<div className="
xl:col-span-2
">



<div className="
bg-white
rounded-2xl
shadow
p-6
">





<div className="
flex
justify-between
items-center
mb-6
">


<h2 className="
text-xl
font-bold
">

Daftar Tugas

</h2>





<div className="
flex
gap-3
">


<button

onClick={()=>setFilter("pending")}

className={`

px-4

py-2

rounded-xl

text-white


${
filter==="pending"

?

"bg-blue-600"

:

"bg-gray-400"

}

`}

>

Belum Selesai

</button>







<button

onClick={()=>setFilter("completed")}

className={`

px-4

py-2

rounded-xl

text-white


${
filter==="completed"

?

"bg-green-600"

:

"bg-gray-400"

}

`}

>

Selesai

</button>



</div>



</div>








<div className="
space-y-5
">



{

filteredTasks.length===0 ?


(

<div className="
text-center
text-gray-400
py-10
">

Belum ada tugas

</div>


)


:


filteredTasks.map((task)=>(


<TaskCard

key={task.id}

task={task}

onDelete={deleteTask}

onComplete={completeTask}

onEdit={editTask}
onProgress={updateProgress}

/>


))


}



</div>




</div>


</div>





</div>








{/* MODAL EDIT */}



{

editingTask &&

<div className="
fixed
inset-0
bg-black/50
flex
items-center
justify-center
z-50
p-4
overflow-y-auto
">



<div className="
bg-white
rounded-2xl
w-full
max-w-md
p-6
shadow-xl
my-8
max-h-[90vh]
overflow-y-auto
">





<h2 className="
text-xl
font-bold
mb-5
">

✏️ Edit Tugas

</h2>


<label className="
block
font-semibold
mb-2
">

Nama Tugas

</label>


<input

value={editingTask.title}

onChange={(e)=>

setEditingTask({

...editingTask,

title:e.target.value

})

}

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

Mata Kuliah

</label>


<input

value={editingTask.course}

onChange={(e)=>

setEditingTask({

...editingTask,

course:e.target.value

})

}

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

Deadline

</label>


<input

type="date"

value={editingTask.deadline}

onChange={(e)=>

setEditingTask({

...editingTask,

deadline:e.target.value

})

}

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

Durasi Pengerjaan

</label>


<input

type="number"

value={editingTask.duration}

onChange={(e)=>

setEditingTask({

...editingTask,

duration:e.target.value

})

}

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

Progress

</label>


<input

type="number"

min="0"

max="100"

value={editingTask.progress || 0}

onChange={(e)=>

setEditingTask({

...editingTask,

progress:Number(e.target.value)

})

}

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

Prioritas

</label>


<select

value={editingTask.priority}

onChange={(e)=>

setEditingTask({

...editingTask,

priority:e.target.value

})

}

className="
w-full
border
rounded-xl
p-3
mb-6
"

>


<option value="High">
Tinggi
</option>


<option value="Medium">
Sedang
</option>


<option value="Low">
Rendah
</option>



</select>








<div className="
flex
gap-3
">


<button

onClick={updateTask}

className="
flex-1
bg-blue-600
text-white
py-3
rounded-xl
"

>

Simpan

</button>





<button

onClick={()=>setEditingTask(null)}

className="
flex-1
bg-gray-300
py-3
rounded-xl
"

>

Batal

</button>



</div>






</div>



</div>



}



</main>



</div>


)


}