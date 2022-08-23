const ErrorHandler = require("../utils/errorhandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const User= require("../modals/userModals");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail.js");
const crypto = require("crypto");
const cloudinary = require("cloudinary");

// Register a User
exports.registerUser = catchAsyncErrors( async(req,res,next)=>{

    const myCloud= await cloudinary.v2.uploader.upload(req.body.avatar,{
        folder:"avatars",
        width: 150,
        crop:"scale",
    })  ;

    const {name , email,password}= req.body;

    const user = await User.create({
        name,email,password,
        avatar:{
            public_id:myCloud.public_id,
            url:myCloud.secure_url,
        }
    });

   sendToken(user,201,res);
});




// Login User
exports.loginUser = catchAsyncErrors (async(req,res,next)=>{

    const {email, password} = req.body;

    //checking if user has given password and email both

    if(!email || !password){
        return next(new ErrorHandler("Please Enter Email and Password"))
    }

    const user =await User.findOne({email }).select("+password");

    if(!user){
        return next(new ErrorHandler("Invalid email or password",401));
    }
    
    const isPasswordMatched = user.comparePassword(password);

    if(!isPasswordMatched){
        return next(ErrorHandler("Invalid email or password",401));

    }

    sendToken(user,200 ,res);

});


//Logout User

exports.logout = catchAsyncErrors (async(req,res,next)=>{

    res.cookie("token", null , {
        expires : new Date(Date.now()),
        httpOnly: true,
    });
      
    

    res.status(200).json({
        success:true,
        message: "Logged Out",

    });
});



// Forgot password
exports.forgotPassword = catchAsyncErrors(async(req, res, next)=>{

    const user= await User.findOne({email:req.body.email});

    if(!user){
        return next(new ErrorHandler("User not found", 404));
    }

    //Get REset password token

    const resetToken = user.getResetPasswordToken();

    await user.save({validateBeforSave:false});


    const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;


    const message = `Your password reset token is :- \n\n ${resetPasswordUrl} \n\n If you have not requested this email then, please ignore it `;

    try{

      await sendEmail({
          email:user.email,
          subject:`Ecommerce password recovery`,
          message,

      })
      
      res.status(200).json({
          success:true,
          message:`Email sent to ${user.email} successfully`,
      })

    } catch(error){
        user.resetPasswordToken  = undefined;
        user.resetPasswordExpire = undefined;
    
    
    await user.save({validateBeforSave:false});
    
    return next (new ErrorHandler(error.message , 500));
    
    }
})



// reset password
exports.resetPassword = catchAsyncErrors(async (req,res,next)=>{
 
    // creating token hash
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire:{$gt:Date.now()},
    })

    if(!user){
        return next(new ErrorHandler("Reset password token is invalid or has been expired", 400));
    }

    if(req.body.password !== req.body.confirmPassword){
        return next(new ErrorHandler("Password does not match", 400));
    }
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();


    sendToken(user ,200 , res);
});



//Get User Details
exports.getUserDetails = catchAsyncErrors(async(req,res, next )=>{


    const user = await User.findById(req.user.id);

    res.status(200).json({
        success:true,
        user,
    });
});



//update user password
exports.updatePassword = catchAsyncErrors(async(req,res, next )=>{


    const user = await User.findById(req.user.id).select("+password");


    const isPasswordMatched = user.comparePassword(req.body.oldPassword);

    if(!isPasswordMatched){
        return next(new ErrorHandler("Old password is incorrect",400));

    }

    if(req.body.newPassword !== req.body.confirmPassword){
        return next(new ErrorHandler("password does not match",400));
    }

    user.password = req.body.newPassword;

    await user.save();

   sendToken(user , 200 , res);
});




// update user profile
exports.updateProfile = catchAsyncErrors(async(req,res, next )=>{


    const newUserData = {
        name : req.body.name,
        email : req.body.email,
        

    };


    //we will add cloudinary later
            if(req.body.avatar!== ""){
                const user = await User.findById(req.user.id);

                const imageId = user.avatar.public_id;

                await cloudinary.v2.uploader.destroy(imageId);


                const myCloud= await cloudinary.v2.uploader.upload(req.body.avatar,{
                    folder:"avatars",
                    width: 150,
                    crop:"scale",
                });

                newUserData.avatar ={
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url,
                }
            }


    const user = await User.findByIdAndUpdate(req.user.id, newUserData,{
        new:true,
        runValidators:true,
        useFindAndModify:false,
    })

    res.status(200).json({
        success:true,
      
    });

   
});


// Get all users (admin)
exports.getAlluser = catchAsyncErrors(async(req,res,next)=>{
    const users = await User.find();

    if(!users){
        return next(
            new ErrorHandler(`User does not exist with Id : ${req.params.id}`)
        );
   }

    res.status(200).json({
        success:true,
        users,
    });
});


// Get single users (admin)
exports.getSingleuser = catchAsyncErrors(async(req,res,next)=>{
    const user = await User.findById(req.params.id);
 
    if(!user){
         return next(
             new ErrorHandler(`User does not exist with Id : ${req.params.id}`)
         );
    }

    res.status(200).json({
        success:true,
        user,
    });
});




// update user role -- (admin)
exports.updateuserRole = catchAsyncErrors(async(req,res, next )=>{


    const newUserData = {
        name : req.body.name,
        email : req.body.email,
        role : req.body.role,

    };



    const user = await User.findByIdAndUpdate(req.params.id, newUserData,{
        new:true,
        runValidators:true,
        useFindAndModify:false,
    })

    res.status(200).json({
        success:true,
       user,
    });

   
});



// Delete user --Admin
exports.deleteUser = catchAsyncErrors(async(req,res, next )=>{

    const user= await User.findById(req.params.id);

   //we will remove cloudinary later
   

    if(!user){
        return next(
            new ErrorHandler(`User does not exist with Id : ${req.params.id}`)
        );
   }

    await user.remove();

    
    res.status(200).json({
        success:true,
        message:"User deleted successfully"
    });

   
});





