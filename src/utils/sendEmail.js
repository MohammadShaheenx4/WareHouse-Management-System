import nodemailer from "nodemailer";


export async function sendEmail(userEmail, code) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "hamode.sh889@gmail.com", // sender email
            pass: "okim wwzy jqwe wmfv", // app password
        },
    });

    try {
        const info = await transporter.sendMail({
            from: '"Grade Project 👻" <hamode.sh889@gmail.com>', // sender address
            to: userEmail, // recipient email
            subject: "Password Reset Code", // Subject line
            text: `Your password reset code is: ${code}`, // plain text body
            html: `<b>Your password reset code is: ${code}</b>`, // HTML body
        });

        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email: ", error);
    }
}
