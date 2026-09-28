export default function TaskCard({

task,

onComplete,

onDelete,

onEdit,

onProgress

}){


const progress = task.progress || 0;


const remainingHours = Math.max(

0,

Number(task.duration || 0) -

(
Number(task.duration || 0) *
progress /
100
)

);



return(

<div className="
bg-gray-50
rounded-2xl
p-5
border
hover:shadow-md
transition
">





{/* HEADER */}


<div className="
flex
justify-between
items-start
">


<div>


<h3 className="
text-xl
font-bold
text-gray-800
">

{task.title}

</h3>



<p className="
text-gray-500
mt-2
">

📚 {task.course || "-"}

</p>


</div>






<span

className={`

px-4

py-2

rounded-full

text-sm

font-semibold


${
task.priority==="High"

?

"bg-red-100 text-red-600"

:

task.priority==="Medium"

?

"bg-yellow-100 text-yellow-700"

:

"bg-green-100 text-green-600"

}


`}

>


{

task.priority==="High"

?

"Tinggi"

:

task.priority==="Medium"

?

"Sedang"

:

"Rendah"

}


</span>




</div>









{/* DETAIL */}



<div className="
grid
grid-cols-2
gap-4
mt-5
text-gray-600
">


<div>

📅

<span className="
ml-2
">

Deadline:
</span>


<p className="
font-medium
text-gray-800
">

{task.deadline}

</p>


</div>





<div>

⏳

<span className="
ml-2
">

Estimasi:
</span>


<p className="
font-medium
text-gray-800
">

{task.duration} jam

</p>


</div>



</div>









{/* PROGRESS */}



<div className="
mt-6
">


<div className="
flex
justify-between
mb-2
">


<p className="
font-semibold
text-gray-700
">

Progress Penyelesaian

</p>


<p className="
font-bold
text-blue-600
">

{progress}%

</p>


</div>





<div className="
w-full
bg-gray-200
rounded-full
h-3
overflow-hidden
">


<div

className="
bg-gradient-to-r
from-blue-600
to-purple-600
h-3
rounded-full
transition-all
"

style={{

width:`${progress}%`

}}

/>


</div>





<p className="
text-sm
text-gray-500
mt-3
">

⏱️ Sisa pengerjaan:

<span className="
font-semibold
">

{" "}
{remainingHours.toFixed(1)}

jam

</span>


</p>




</div>









{/* SLIDER */}


<div className="
mt-5
">


<input

type="range"

min="0"

max="100"

value={progress}

onChange={(e)=>

onProgress(

task.id,

Number(e.target.value)

)

}

className="
w-full
cursor-pointer
"

/>


</div>









{/* BUTTON */}



<div className="
flex
gap-3
mt-6
">


<button

onClick={()=>onEdit(task)}

className="
flex-1
bg-blue-600
text-white
py-3
rounded-xl
hover:bg-blue-700
"

>

✏️ Edit

</button>






<button

onClick={()=>onComplete(task.id)}

className="
flex-1
bg-green-500
text-white
py-3
rounded-xl
hover:bg-green-600
"

>

✓ Selesai

</button>







<button

onClick={()=>onDelete(task.id)}

className="
flex-1
bg-red-500
text-white
py-3
rounded-xl
hover:bg-red-600
"

>

🗑 Hapus

</button>





</div>







</div>


)

}