'use client';

import Image from "next/image";
import { Button, ThemeProvider, createTheme, responsiveFontSizes, Box, Stack, TextField, Typography, CircularProgress } from "@mui/material";
import {visuallyHidden} from "@mui/utils";
import { useState } from "react";

//For the AI and the user, but user's don't need the font and font weight
interface Message {
  role: string;
  content: string;
  fontFamily?: string;
  fontWeightLight?: number;
  fontWeightRegular?: number;
  fontWeightMedium?: number;
  fontWeightBold?: number;
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#74AA9C'
    },
    secondary: {
      main: '#448AFF'
    },
  },
  typography: {
    fontFamily: 'Quicksand',
    fontWeightLight: 400,
    fontWeightRegular: 500,
    fontWeightMedium: 600,
    fontWeightBold: 700,
  },
})

export default function Home() {
  //for sending the file to the backend
  const [file, setFile] = useState<File | null>(null);
  //For changing the file name, when adding file
  const [fileName, setFileName] = useState<string>("");
  //for adding the file
  const [loading, setLoading] = useState<boolean>(false);
  //for uploading the file
  const [upload, setUpload] = useState<boolean>(false);



  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFile = e.target.files?.[0];

    if(!inputFile){
      return;
    }

    setLoading(true);
    try{
      setFile(inputFile);
      setFileName(inputFile.name);
    } finally {
      setLoading(false);
    }
  }

  const uploadFile = async () => {
    if(!file){
      alert("You must provide a pdf file first.");
      return;
    }

    setUpload(true);

    try{
      const formData = new FormData();
      formData.append("file", file);

      const upload = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      console.log(upload);
    } catch (err) {
      console.log(err);
    } finally{
      setUpload(false);
    }

    setFileName("");
  }

  //This is the AI useState
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm PDF Document reader agent. How may I assist you today?",
      fontFamily: "Quicksand",
      fontWeightLight: 400,
      fontWeightRegular: 500,
      fontWeightMedium: 600,
      fontWeightBold: 700,
    },
  ]);

  //This is the user's useState
  const [message, setMessage] = useState<string>("")

  const sendMessage = async () => {

    setMessages((messages) => [
      ...messages,
      {role: "user", content: message},
      {role: "assistant", content: ''} // placeholder for AI's reply
    ])

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: message },
    ];
    setMessage("");

    try {
      //calls the fetch function to call the backend, using POST method
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newMessages),
      });

      if (!response.body) {
        throw new Error("Readable stream is not available on the response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      const processStream = async (): Promise<string> => {
        const { done, value } = await reader.read();

        //Base case: if done is true, then it returns test, knowing that 
        //the stream is done
        if (done) {
          return assistantText;
        }

        assistantText += decoder.decode(value ?? new Uint8Array(), { stream: true });

        setMessages((prevMessages) => {
          const updated = [...prevMessages];
          const lastIndex = updated.length - 1;
          updated[lastIndex] = { ...updated[lastIndex], content: assistantText };
          return updated;
        });

        //calls a recursive function
        return processStream();
      };

      await processStream();
    } catch (error) {
      console.error("Failed to send message", error);
    }
  }

  return (
    <ThemeProvider theme={responsiveFontSizes(theme)}>
      <Box
        width="100%"
        height="100vh"
        display="flex"
        flexDirection="row"
        bgcolor="#282828"
        justifyContent="space-around"
        alignItems="center"
      >
        <Stack
          direction="column"
          width="850px" 
          height="750px" 
          border="1px solid black" 
          p={2} 
          spacing={12}
          borderRadius={4}
          borderColor="white"
          bgcolor="white"
          boxShadow= "0px 0px 50px white"
          m={2}
        >
          <Stack
            direction="column" 
            spacing={2} 
            flexGrow={1} 
            overflow="auto" 
            maxHeight="100%"
          >
          {
            messages.map((message, index) => (
              <Box
                key={index}
                display="flex"
                justifyContent={
                  message.role === "assistant" ? 'flex-start' : 'flex-end'
                }
              >
                <Box
                  bgcolor={
                    message.role === "assistant" ? "primary.main" : "secondary.main"
                  }
                  color="white"
                  borderRadius={16}
                  p={3}
                  fontFamily='Quicksand'
                >
                  {message.content}
                </Box>
              </Box>
            ))
          }
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Message"
              fullWidth
              value = {message}
              onChange={(e)=> {
                setMessage(e.target.value)
              }}
            />
            <Button variant="contained" onClick={sendMessage}>
              <Typography color="white">
                Send
              </Typography>
            </Button>
          </Stack>
        </Stack>

        <Stack
          direction="column"
          justifyContent="center"
          spacing={12}
        >
          {loading ? (
            <Button
              variant="outlined"
              component="label"
              disabled
            >
              <CircularProgress size={20}/>
              Processing...
            </Button>
          ): (
            <Button
              variant="outlined"
              component="label"
            >
              Add File
              <input
                hidden
                type="file"
                accept="application/pdf"
                onChange={handleFile}
              />
            </Button>
          )}
          <Typography
            variant="body1"
            noWrap
            sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {fileName}
          </Typography>
          
          {upload ? (
            <Button
              variant="outlined"
              component="label"
              disabled
            >
              <CircularProgress size={20}/>
              Processing...
            </Button>
          ): (          
            <Button
              component="label"
              role={undefined}
              variant="outlined"
              tabIndex={-1}
              fullWidth
              onClick={uploadFile}
            >
              Upload files
            </Button>
          )}
        </Stack>
      </Box>
    </ThemeProvider>
  );
}



