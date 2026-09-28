import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { useNavigate } from "react-router-dom";


export default function Register(){

const navigate = useNavigate();


const [form,setForm] = useState({

name:"",
email:"",
password:"",
university:"",
major:"",
semester:""

});


const handleChange=(e)=>{

setForm({

...form,

[e.target.name]:e.target.value

});

};



const handleRegister=async(e)=>{

e.preventDefault();


try{


// 1. Create Firebase Account

const userCredential =
await createUserWithEmailAndPassword(

auth,

form.email,

form.password

);



const user=userCredential.user;



// 2. Save Profile Firestore

await setDoc(

doc(db,"users",user.uid),

{

name:form.name,

email:form.email,

university:form.university,

major:form.major,

semester:Number(form.semester),

createdAt:new Date()

}

);



alert("Register berhasil");


navigate("/dashboard");



}catch(error){

alert(error.message);

}


};



return(

<div className="
min-h-screen
flex
items-center
justify-center
bg-gray-100
">


<form

onSubmit={handleRegister}

className="
bg-white
shadow-xl
rounded-2xl
p-8
w-full
max-w-md
">


<h1 className="
text-3xl
font-bold
mb-6
text-center
">

Create StudyFlow Account

</h1>



<input

name="name"

placeholder="Nama Lengkap"

onChange={handleChange}

className="input"

/>


<input

name="email"

placeholder="Email"

onChange={handleChange}

className="input"

/>


<input

type="password"

name="password"

placeholder="Password"

onChange={handleChange}

className="input"

/>


<input

name="university"

placeholder="Universitas"

onChange={handleChange}

className="input"

/>


<input

name="major"

placeholder="Program Studi"

onChange={handleChange}

className="input"

/>


<input

name="semester"

placeholder="Semester"

onChange={handleChange}

className="input"

/>



<button

className="
bg-blue-600
text-white
w-full
py-3
rounded-xl
mt-4
hover:bg-blue-700
"

>

Register

</button>



</form>


</div>

)

}